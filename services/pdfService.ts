
import { jsPDF } from 'jspdf';
import type { Scene, Character, Shot, Reference, Episode, ArcPoint, Author } from '../types';
import type { PDFExportOptions } from '../components/PDFExportModal';

// --- CONFIGURACIÓN Y ESTILOS ---
const CONFIG = {
    MARGIN: 15,
    PAGE_HEIGHT: 297, // A4 mm
    PAGE_WIDTH: 210,  // A4 mm
    CONTENT_WIDTH: 180, // 210 - (15 * 2)
    COL_GAP: 6,
    ROW_GAP: 10,
    HEADER_HEIGHT: 15,
    FOOTER_HEIGHT: 10,
};

const COLORS = {
    TEXT_MAIN: '#1f2937',    // Gray 800
    TEXT_SEC: '#4b5563',     // Gray 600
    TEXT_LIGHT: '#9ca3af',   // Gray 400
    ACCENT: '#374151',       // Gray 700 (Elegant dark)
    ACCENT_BLUE: '#2563eb',  // Royal Blue
    BG_BOX: '#f3f4f6',       // Gray 100
    BORDER: '#e5e7eb',       // Gray 200
    SCENE_BG: '#111827',     // Gray 900 (Header de escena)
};

const FONTS = {
    TITLE: { size: 24, weight: 'bold' },
    SUBTITLE: { size: 16, weight: 'bold' },
    SECTION: { size: 14, weight: 'bold' },
    BODY: { size: 10, weight: 'normal' },
    SMALL: { size: 8, weight: 'normal' },
    TINY: { size: 7, weight: 'normal' },
};

// --- CLASE GESTORA DEL DOCUMENTO ---
class PDFGenerator {
    doc: jsPDF;
    y: number;
    t: (key: string) => string;

    constructor(t: (key: string) => string) {
        this.doc = new jsPDF();
        this.y = CONFIG.MARGIN;
        this.t = t;
    }

    // --- UTILIDADES DE TEXTO Y MEDIDAS ---

    // Convierte pt a mm para cálculos de altura de línea
    getLineHeight(fontSize: number) {
        return fontSize * 0.3527 * 1.25; // Factor 1.25 para interlineado cómodo
    }

    // Mide la altura que ocupará un bloque de texto
    measureText(text: string, fontSize: number, maxWidth: number): number {
        if (!text) return 0;
        this.doc.setFontSize(fontSize);
        const lines = this.doc.splitTextToSize(text, maxWidth);
        return lines.length * this.getLineHeight(fontSize);
    }

    // Verifica si hay espacio, si no, crea nueva página
    // safeZone: espacio extra requerido (para evitar dejar un título solo al final)
    checkPageBreak(heightNeeded: number) {
        const limit = CONFIG.PAGE_HEIGHT - CONFIG.MARGIN - CONFIG.FOOTER_HEIGHT;
        if (this.y + heightNeeded > limit) {
            this.doc.addPage();
            this.y = CONFIG.MARGIN;
            return true;
        }
        return false;
    }

    // Dibuja texto y avanza Y
    printText(text: string, fontSize: number, weight: 'normal' | 'bold' | 'italic', color: string, maxWidth: number, align: 'left' | 'center' | 'right' = 'left') {
        if (!text) return;
        
        this.doc.setFontSize(fontSize);
        this.doc.setFont('helvetica', weight);
        this.doc.setTextColor(color);

        const lines = this.doc.splitTextToSize(text, maxWidth);
        const lineHeight = this.getLineHeight(fontSize);

        // Ajuste de X según alineación
        let x = CONFIG.MARGIN;
        if (align === 'center') x = CONFIG.PAGE_WIDTH / 2;
        if (align === 'right') x = CONFIG.PAGE_WIDTH - CONFIG.MARGIN;

        this.doc.text(lines, x, this.y + (lineHeight * 0.7), { align, maxWidth });
        this.y += lines.length * lineHeight;
    }

    // Dibuja una línea divisoria
    drawDivider(spaceAfter: number = 5) {
        this.y += 2;
        this.doc.setDrawColor(COLORS.BORDER);
        this.doc.setLineWidth(0.1);
        this.doc.line(CONFIG.MARGIN, this.y, CONFIG.PAGE_WIDTH - CONFIG.MARGIN, this.y);
        this.y += spaceAfter;
    }

    // --- COMPONENTES ---

    drawCover(title: string, author: string, stats: {episodes: number, characters: number}) {
        this.y = 80;
        
        // Título Principal
        this.printText(title.toUpperCase(), 32, 'bold', COLORS.TEXT_MAIN, CONFIG.CONTENT_WIDTH, 'center');
        this.y += 10;

        // Autor Principal
        if (author) {
            this.printText(this.t('pdfByAuthor').replace('{authorName}', author), 14, 'normal', COLORS.TEXT_SEC, CONFIG.CONTENT_WIDTH, 'center');
        }

        this.y = 220;
        
        // Caja de Metadatos
        this.doc.setDrawColor(COLORS.BORDER);
        this.doc.line(CONFIG.PAGE_WIDTH/2 - 40, this.y, CONFIG.PAGE_WIDTH/2 + 40, this.y);
        this.y += 10;
        
        this.printText(`${this.t('episodes')}: ${stats.episodes}`, 10, 'bold', COLORS.TEXT_MAIN, CONFIG.CONTENT_WIDTH, 'center');
        this.printText(`${this.t('characters')}: ${stats.characters}`, 10, 'bold', COLORS.TEXT_MAIN, CONFIG.CONTENT_WIDTH, 'center');
        this.printText(`${this.t('pdfGeneratedOn')} ${new Date().toLocaleDateString()}`, 9, 'normal', COLORS.TEXT_LIGHT, CONFIG.CONTENT_WIDTH, 'center');

        this.doc.addPage();
        this.y = CONFIG.MARGIN;
    }

    drawAuthors(authors: Author[]) {
        if (!authors || authors.length === 0) return;

        this.drawSectionTitle(this.t('authorsTitle'));
        
        // Table Header
        this.doc.setFillColor(COLORS.BG_BOX);
        this.doc.rect(CONFIG.MARGIN, this.y, CONFIG.CONTENT_WIDTH, 8, 'F');
        this.doc.setFontSize(8);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setTextColor(COLORS.TEXT_SEC);
        
        const cols = { name: 5, role: 60, email: 110, part: 160 };
        this.doc.text(this.t('authorName').toUpperCase(), CONFIG.MARGIN + cols.name, this.y + 5.5);
        this.doc.text(this.t('authorRole').toUpperCase(), CONFIG.MARGIN + cols.role, this.y + 5.5);
        this.doc.text(this.t('email').toUpperCase(), CONFIG.MARGIN + cols.email, this.y + 5.5);
        this.doc.text("%", CONFIG.MARGIN + cols.part, this.y + 5.5);
        
        this.y += 10;

        authors.forEach((author, idx) => {
            this.doc.setFontSize(9);
            this.doc.setFont('helvetica', 'bold');
            this.doc.setTextColor(COLORS.TEXT_MAIN);
            this.doc.text(author.name, CONFIG.MARGIN + cols.name, this.y);
            
            this.doc.setFont('helvetica', 'normal');
            this.doc.text(author.role, CONFIG.MARGIN + cols.role, this.y);
            
            this.doc.setTextColor(COLORS.TEXT_SEC);
            this.doc.text(author.email, CONFIG.MARGIN + cols.email, this.y);
            
            this.doc.text(author.participation ? `${author.participation}%` : '-', CONFIG.MARGIN + cols.part, this.y);
            
            this.doc.setDrawColor(COLORS.BORDER);
            this.doc.line(CONFIG.MARGIN, this.y + 3, CONFIG.MARGIN + CONFIG.CONTENT_WIDTH, this.y + 3);
            
            this.y += 8;
        });

        this.y += 10;
    }

    drawSectionTitle(title: string) {
        this.checkPageBreak(30); // Asegurar que el título no quede solo
        this.y += 5;
        this.doc.setFillColor(COLORS.ACCENT_BLUE);
        this.doc.rect(CONFIG.MARGIN, this.y, 5, 10, 'F'); // Decoración lateral
        
        this.doc.setFontSize(FONTS.TITLE.size);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setTextColor(COLORS.TEXT_MAIN);
        this.doc.text(title.toUpperCase(), CONFIG.MARGIN + 8, this.y + 8);
        
        this.y += 18;
    }

    drawBible(logline: string, treatment: string, structuralAnalysis: string, narrativeArc: ArcPoint[]) {
        this.drawSectionTitle(this.t('outlineTab'));

        // Logline
        if (logline) {
            this.printText(this.t('logline').toUpperCase(), FONTS.BODY.size, 'bold', COLORS.ACCENT_BLUE, CONFIG.CONTENT_WIDTH);
            this.y += 2;
            this.printText(logline, 11, 'italic', COLORS.TEXT_MAIN, CONFIG.CONTENT_WIDTH);
            this.y += 10;
        }

        // Arco Narrativo (Gráfico Simplificado)
        if (narrativeArc && narrativeArc.length > 0) {
            this.checkPageBreak(60);
            this.printText(this.t('narrativeArcTitle').toUpperCase(), FONTS.BODY.size, 'bold', COLORS.ACCENT_BLUE, CONFIG.CONTENT_WIDTH);
            this.y += 5;
            this.drawGraph(narrativeArc);
            this.y += 10;
        }

        // Tratamiento
        if (treatment) {
            this.checkPageBreak(50);
            this.printText(this.t('treatment').toUpperCase(), FONTS.BODY.size, 'bold', COLORS.ACCENT_BLUE, CONFIG.CONTENT_WIDTH);
            this.y += 2;
            this.printText(treatment, FONTS.BODY.size, 'normal', COLORS.TEXT_SEC, CONFIG.CONTENT_WIDTH);
            this.y += 10;
        }

        // Análisis Estructural
        if (structuralAnalysis) {
            this.checkPageBreak(50);
            this.printText(this.t('structuralAnalysis').toUpperCase(), FONTS.BODY.size, 'bold', COLORS.ACCENT_BLUE, CONFIG.CONTENT_WIDTH);
            this.y += 2;
            this.printText(structuralAnalysis, FONTS.BODY.size, 'normal', COLORS.TEXT_SEC, CONFIG.CONTENT_WIDTH);
        }

        this.doc.addPage();
        this.y = CONFIG.MARGIN;
    }

    drawGraph(arc: ArcPoint[]) {
        const height = 40;
        const width = CONFIG.CONTENT_WIDTH;
        const bottomY = this.y + height;
        
        // Fondo
        this.doc.setFillColor(COLORS.BG_BOX);
        this.doc.rect(CONFIG.MARGIN, this.y, width, height, 'F');

        // Ejes
        this.doc.setDrawColor(COLORS.BORDER);
        this.doc.line(CONFIG.MARGIN, bottomY, CONFIG.MARGIN + width, bottomY);

        const sorted = [...arc].sort((a, b) => (a.x || 0) - (b.x || 0));
        const getX = (val: number) => CONFIG.MARGIN + (val / 100) * width;
        const getY = (val: number) => bottomY - (val / 10) * height;

        // Dibujar curvas
        const drawCurve = (key: 'tension' | 'emotion' | 'conflict', color: string) => {
            this.doc.setDrawColor(color);
            this.doc.setLineWidth(0.5);
            let lastX = -1, lastY = -1;
            sorted.forEach(p => {
                const px = getX(p.x || 0);
                const py = getY((p as any)[key]);
                if (lastX !== -1) this.doc.line(lastX, lastY, px, py);
                lastX = px; lastY = py;
            });
        };

        drawCurve('tension', '#ef4444');
        drawCurve('emotion', '#06b6d4');
        drawCurve('conflict', '#f59e0b');

        this.y += height + 5;
    }

    drawCharacters(characters: Character[]) {
        if (characters.length === 0) return;
        this.drawSectionTitle(this.t('characters'));

        characters.forEach((char, index) => {
            // Calcular altura necesaria
            const descHeight = this.measureText(char.personality, 9, 110) + this.measureText(char.appearance, 9, 110) + 40;
            const neededHeight = Math.max(60, descHeight);

            this.checkPageBreak(neededHeight + 10);

            // Contenedor
            this.doc.setDrawColor(COLORS.BORDER);
            this.doc.setFillColor(255, 255, 255);
            this.doc.roundedRect(CONFIG.MARGIN, this.y, CONFIG.CONTENT_WIDTH, neededHeight, 2, 2, 'FD');

            // Imagen (Izquierda)
            const imgW = 40;
            const imgH = 55;
            if (char.images.length > 0 && char.images[0].startsWith('data:')) {
                try {
                    this.doc.addImage(char.images[0], 'PNG', CONFIG.MARGIN + 3, this.y + 3, imgW, imgH, undefined, 'FAST');
                } catch(e) {}
            } else {
                this.doc.setFillColor(COLORS.BG_BOX);
                this.doc.rect(CONFIG.MARGIN + 3, this.y + 3, imgW, imgH, 'F');
            }

            // Texto (Derecha)
            const textX = CONFIG.MARGIN + imgW + 8;
            const textW = CONFIG.CONTENT_WIDTH - imgW - 12;
            let localY = this.y + 8;

            this.doc.setFontSize(14);
            this.doc.setFont('helvetica', 'bold');
            this.doc.setTextColor(COLORS.TEXT_MAIN);
            this.doc.text(char.name, textX, localY);
            
            localY += 5;
            this.doc.setFontSize(10);
            this.doc.setFont('helvetica', 'italic');
            this.doc.setTextColor(COLORS.TEXT_LIGHT);
            this.doc.text(char.role, textX, localY);

            localY += 8;
            
            const printField = (label: string, val: string) => {
                if (!val) return;
                this.doc.setFontSize(9);
                this.doc.setFont('helvetica', 'bold');
                this.doc.setTextColor(COLORS.TEXT_SEC);
                this.doc.text(label + ": ", textX, localY);
                const labelW = this.doc.getTextWidth(label + ": ");
                
                this.doc.setFont('helvetica', 'normal');
                const lines = this.doc.splitTextToSize(val, textW - labelW);
                this.doc.text(lines, textX + labelW, localY);
                localY += (lines.length * 4) + 2;
            };

            printField(this.t('pdfPersonality'), char.personality);
            printField(this.t('pdfAppearance'), char.appearance);
            printField(this.t('characterOutfit'), char.outfit);

            this.y += neededHeight + 5;
        });

        this.doc.addPage();
        this.y = CONFIG.MARGIN;
    }

    // --- STORYBOARD (GRID COMPLEX) ---

    drawEpisodes(episodes: Episode[], includeTech: boolean, activeEpId: number | null, allEps: boolean) {
        const epsToDraw = allEps ? episodes : episodes.filter(e => e.id === activeEpId);

        epsToDraw.forEach(ep => {
            if (this.y > CONFIG.MARGIN) this.doc.addPage();
            this.y = CONFIG.MARGIN;

            // Header Episodio
            this.printText(ep.title.toUpperCase(), 20, 'bold', COLORS.TEXT_MAIN, CONFIG.CONTENT_WIDTH);
            this.y += 5;
            
            if (ep.synopsis) {
                this.printText("SYNOPSIS", 10, 'bold', COLORS.ACCENT_BLUE, CONFIG.CONTENT_WIDTH);
                this.y += 2;
                this.printText(ep.synopsis, 10, 'italic', COLORS.TEXT_SEC, CONFIG.CONTENT_WIDTH);
                this.y += 10;
            }

            ep.scenes.forEach((scene, index) => {
                this.drawScene(scene, index + 1, includeTech);
            });
        });
    }

    drawScene(scene: Scene, index: number, includeTech: boolean) {
        // 1. Preparar Textos
        const titleText = `${this.t('scene').toUpperCase()} ${index}: ${scene.title}`;
        const locText = `${scene.location || ''} ${scene.setting ? `| ${scene.setting}` : ''}`;

        // 2. Medir Título (Izquierda)
        this.doc.setFontSize(12);
        this.doc.setFont('helvetica', 'bold');
        // Ancho máximo para título: 65% del ancho disponible para dar espacio a la ubicación
        const titleMaxWidth = CONFIG.CONTENT_WIDTH * 0.65;
        const titleLines = this.doc.splitTextToSize(titleText, titleMaxWidth);
        
        // 3. Medir Ubicación (Derecha)
        this.doc.setFontSize(10);
        this.doc.setFont('helvetica', 'normal');
        // Ancho máximo para ubicación: 30% del ancho disponible
        const locMaxWidth = CONFIG.CONTENT_WIDTH * 0.30;
        const locLines = this.doc.splitTextToSize(locText, locMaxWidth);

        // 4. Calcular Altura de la Caja (Header)
        const titleLineH = this.getLineHeight(12);
        const locLineH = this.getLineHeight(10);
        
        const titleBlockH = titleLines.length * titleLineH;
        const locBlockH = locLines.length * locLineH;
        
        const maxContentH = Math.max(titleBlockH, locBlockH);
        const boxPadding = 8; // 4mm padding arriba y abajo
        const boxHeight = maxContentH + boxPadding;

        // 5. Verificar Salto de Página
        // Necesitamos espacio para el header + al menos un poco de la descripción o un plano
        this.checkPageBreak(boxHeight + 20);

        // 6. Dibujar Fondo (Barra Negra)
        this.doc.setFillColor(COLORS.SCENE_BG);
        this.doc.rect(CONFIG.MARGIN, this.y, CONFIG.CONTENT_WIDTH, boxHeight, 'F');
        
        // 7. Dibujar Título
        this.doc.setTextColor('#FFFFFF');
        this.doc.setFontSize(12);
        this.doc.setFont('helvetica', 'bold');
        // Ajuste vertical: padding + compensación de baseline
        this.doc.text(titleLines, CONFIG.MARGIN + 3, this.y + 4 + (titleLineH * 0.75));
        
        // 8. Dibujar Ubicación
        this.doc.setFontSize(10);
        this.doc.setFont('helvetica', 'normal');
        this.doc.text(locLines, CONFIG.MARGIN + CONFIG.CONTENT_WIDTH - 3, this.y + 4 + (locLineH * 0.75), { align: 'right' });

        // 9. Avanzar Y
        this.y += boxHeight + 5;

        // Descripción Escena (Fuera del header negro)
        if (scene.actions) {
            this.printText(scene.actions, 10, 'normal', COLORS.TEXT_MAIN, CONFIG.CONTENT_WIDTH);
            this.y += 5;
        }

        // GRID DE PLANOS (2 Columnas)
        const colWidth = (CONFIG.CONTENT_WIDTH - CONFIG.COL_GAP) / 2;
        
        for (let i = 0; i < scene.shots.length; i += 2) {
            const shotA = scene.shots[i];
            const shotB = scene.shots[i+1]; // Puede ser undefined

            // Calcular altura requerida para ESTA fila
            const heightA = this.calculateShotHeight(shotA, colWidth, includeTech);
            const heightB = shotB ? this.calculateShotHeight(shotB, colWidth, includeTech) : 0;
            const rowHeight = Math.max(heightA, heightB);

            // Verificar salto de página para TODA la fila
            if (this.checkPageBreak(rowHeight + 5)) {
                // Si saltamos, reimprimir un mini header de "Escena X (cont)" sería ideal, pero por simplicidad solo seguimos
            }

            const startY = this.y;

            // Dibujar A
            this.drawShot(shotA, i + 1, CONFIG.MARGIN, startY, colWidth, rowHeight, includeTech);

            // Dibujar B
            if (shotB) {
                this.drawShot(shotB, i + 2, CONFIG.MARGIN + colWidth + CONFIG.COL_GAP, startY, colWidth, rowHeight, includeTech);
            }

            this.y = startY + rowHeight + CONFIG.ROW_GAP;
        }
        
        this.drawDivider(5);
    }

    calculateShotHeight(shot: Shot, width: number, includeTech: boolean): number {
        const imgHeight = width * (9/16); // 16:9 ratio fijo para uniformidad
        let h = imgHeight + 5; // Imagen + gap

        // Header (Tipo + Duración)
        h += 6;

        // Descripción
        h += this.measureText(shot.description, 9, width) + 3;

        // Tech Details
        if (includeTech) {
            const techLines = this.getTechLines(shot);
            if (techLines.length > 0) {
                // Caja gris: padding top/bottom (4) + lineas
                h += (techLines.length * 4) + 6; 
            }
        }

        return h + 5; // Padding final
    }

    getTechLines(shot: Shot) {
        const fields = [
            { l: this.t('shotType'), v: shot.shotType },
            { l: this.t('cameraMovement'), v: shot.cameraMovement },
            { l: this.t('lensType'), v: shot.lensType },
            { l: this.t('lightingScheme'), v: shot.lighting },
            { l: this.t('soundFx'), v: shot.soundFx },
        ];
        return fields.filter(f => f.v && f.v !== 'None' && f.v !== 'Unassigned' && f.v !== 'Default');
    }

    drawShot(shot: Shot, index: number, x: number, y: number, width: number, totalHeight: number, includeTech: boolean) {
        let currY = y;

        // 1. Imagen
        const imgHeight = width * (9/16);
        this.doc.setFillColor(COLORS.BG_BOX);
        this.doc.rect(x, currY, width, imgHeight, 'F'); // Placeholder gris

        if (shot.imageUrl && shot.imageUrl.startsWith('data:')) {
            try {
                // Ajuste de "object-cover" manual
                this.doc.addImage(shot.imageUrl, 'PNG', x, currY, width, imgHeight, undefined, 'FAST');
            } catch(e) {}
        }

        // Badge Número
        this.doc.setFillColor(COLORS.ACCENT_BLUE);
        this.doc.rect(x, currY, 8, 6, 'F');
        this.doc.setFontSize(7);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setTextColor('#FFFFFF');
        this.doc.text(`${index}`, x + 4, currY + 4, { align: 'center' });

        // Badge Duración
        const durText = `${shot.duration}s`;
        const durW = this.doc.getTextWidth(durText) + 4;
        this.doc.setFillColor(COLORS.SCENE_BG);
        this.doc.rect(x + width - durW, currY + imgHeight - 6, durW, 6, 'F');
        this.doc.text(durText, x + width - durW/2, currY + imgHeight - 2, { align: 'center' });

        currY += imgHeight + 4;

        // 2. Header Plano
        this.doc.setFontSize(9);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setTextColor(COLORS.TEXT_MAIN);
        // Cortar texto si es muy largo
        let typeText = shot.shotType || this.t('shot');
        if (this.doc.getTextWidth(typeText) > width) typeText = typeText.substring(0, 25) + '...';
        this.doc.text(typeText, x, currY);
        
        currY += 4;

        // 3. Descripción
        this.doc.setFontSize(9);
        this.doc.setFont('helvetica', 'normal');
        this.doc.setTextColor(COLORS.TEXT_SEC);
        const descLines = this.doc.splitTextToSize(shot.description, width);
        this.doc.text(descLines, x, currY + 3); // +3 baseline
        currY += (descLines.length * this.getLineHeight(9)) + 2;

        // 4. Detalles Técnicos (Grid)
        if (includeTech) {
            const techLines = this.getTechLines(shot);
            if (techLines.length > 0) {
                const boxH = (techLines.length * 4) + 4;
                
                this.doc.setFillColor(COLORS.BG_BOX);
                this.doc.roundedRect(x, currY, width, boxH, 1, 1, 'F');
                
                let techY = currY + 4;
                this.doc.setFontSize(7);
                
                techLines.forEach(field => {
                    this.doc.setFont('helvetica', 'bold');
                    this.doc.setTextColor(COLORS.TEXT_LIGHT);
                    this.doc.text(field.l + ":", x + 2, techY);
                    
                    this.doc.setFont('helvetica', 'normal');
                    this.doc.setTextColor(COLORS.TEXT_SEC);
                    const labelW = this.doc.getTextWidth(field.l + ": ");
                    
                    // Truncate valor para que no desborde
                    let val = field.v;
                    const maxValW = width - labelW - 4;
                    if (this.doc.getTextWidth(val) > maxValW) {
                        // Simple truncado aproximado
                        val = val.substring(0, 30) + '...'; 
                    }
                    this.doc.text(val, x + 2 + labelW, techY);
                    
                    techY += 4;
                });
            }
        }
    }

    drawReferences(references: Reference[]) {
        if (references.length === 0) return;
        this.doc.addPage();
        this.y = CONFIG.MARGIN;
        
        this.drawSectionTitle(this.t('references'));

        references.forEach(ref => {
            this.checkPageBreak(25);
            this.doc.setTextColor(COLORS.ACCENT_BLUE);
            this.doc.setFontSize(11);
            this.doc.setFont('helvetica', 'bold');
            this.doc.text(ref.title, CONFIG.MARGIN, this.y);
            
            // Link simple
            const w = this.doc.getTextWidth(ref.title);
            this.doc.link(CONFIG.MARGIN, this.y - 3, w, 4, { url: ref.uri });

            this.y += 5;
            this.printText(ref.description, 9, 'normal', COLORS.TEXT_SEC, CONFIG.CONTENT_WIDTH);
            this.y += 8;
        });
    }

    drawFooter(page: number, total: number) {
        const str = `${this.t('pdfPageInfo').replace('{page}', page.toString()).replace('{total}', total.toString())}`;
        this.doc.setFontSize(8);
        this.doc.setTextColor(COLORS.TEXT_LIGHT);
        this.doc.text(str, CONFIG.PAGE_WIDTH / 2, CONFIG.PAGE_HEIGHT - 5, { align: 'center' });
    }

    save(filename: string) {
        const totalPages = this.doc.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            this.doc.setPage(i);
            this.drawFooter(i, totalPages);
        }
        const safeName = filename.replace(/[^a-z0-9]/gi, '_') || 'Storyboard';
        this.doc.save(`${safeName}.pdf`);
    }
}

// --- FUNCIÓN PRINCIPAL EXPORTADA ---

export const exportStoryboardToPDF = async (
    title: string,
    author: string,
    episodes: Episode[],
    activeEpisodeId: number | null,
    characters: Character[],
    style: string,
    aspectRatio: string,
    t: (key: string) => string,
    soundtrackPrompt: string,
    logline: string,
    structuralAnalysis: string,
    treatment: string,
    references: Reference[],
    narrativeArc: ArcPoint[],
    authors: Author[],
    options: PDFExportOptions
) => {
    try {
        const generator = new PDFGenerator(t);

        // 1. Portada
        if (options.includeCover) {
            generator.drawCover(title, author, { 
                episodes: episodes.length, 
                characters: characters.length 
            });
        }

        // 2. Production Team (Authors) - Included after cover or before bible
        if (options.includeMetadata && authors && authors.length > 0) {
             generator.drawAuthors(authors);
        }

        // 3. Biblia
        if (options.includeBible) {
            generator.drawBible(logline, treatment, structuralAnalysis, options.includeNarrativeArc ? narrativeArc : []);
        }

        // 4. Personajes
        if (options.includeCharacters) {
            generator.drawCharacters(characters);
        }

        // 5. Storyboard (Episodios -> Escenas -> Grid Planos)
        // Forzamos "Compact" (2 columnas) como pidió el usuario
        generator.drawEpisodes(episodes, options.includeTechDetails, activeEpisodeId, options.includeAllEpisodes);

        // 6. Referencias
        if (options.includeReferences) {
            generator.drawReferences(references);
        }

        // Guardar
        generator.save(title);

    } catch (e) {
        console.error("PDF Gen Error", e);
        alert("Error generando PDF: " + (e as Error).message);
    }
};
