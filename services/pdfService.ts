
import { jsPDF } from 'jspdf';
import type { Scene, Character, Shot, Reference, Episode, ArcPoint } from '../types';
import type { PDFExportOptions } from '../components/PDFExportModal';

// --- CONSTANTS & THEME ---
const MARGIN = 15;
const PAGE_HEIGHT = 297; // A4 mm
const PAGE_WIDTH = 210;  // A4 mm
const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);

const COLORS = {
    BLACK: '#111827',
    GRAY_DARK: '#374151',   
    GRAY_MEDIUM: '#6b7280', 
    GRAY_LIGHT: '#d1d5db',  
    BG_LIGHT: '#f3f4f6',    
    ACCENT: '#4f46e5',      
    BORDER: '#e5e7eb',
};

const FONTS = {
    TITLE: 22,
    HEADER: 14,
    SUBHEADER: 11,
    BODY: 9,
    SMALL: 8,
    TINY: 7
};

// --- HELPER FUNCTIONS ---

// Estimate text height without drawing
const getTextHeight = (doc: jsPDF, text: string, maxWidth: number, fontSize: number, lineHeightFactor: number = 1.2): number => {
    if (!text) return 0;
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, maxWidth);
    // 1 pt = 0.3527 mm
    return lines.length * (fontSize * 0.3527 * lineHeightFactor);
};

// Draw wrapped text and return new Y position
const printWrappedText = (
    doc: jsPDF, 
    text: string, 
    x: number, 
    y: number, 
    maxWidth: number, 
    fontSize: number, 
    fontStyle: 'normal' | 'bold' | 'italic' = 'normal', 
    color: string = COLORS.BLACK,
    align: 'left' | 'center' | 'right' | 'justify' = 'left'
): number => {
    if (!text) return y;
    
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', fontStyle);
    doc.setTextColor(color);
    
    const lines = doc.splitTextToSize(text, maxWidth);
    const lineHeight = fontSize * 0.3527 * 1.2;
    
    doc.text(lines, x, y + (fontSize * 0.3527), { align, maxWidth }); // + adjustment for baseline
    return y + (lines.length * lineHeight);
};

// --- COMPONENT DRAWERS ---

const drawNarrativeArc = (doc: jsPDF, arc: ArcPoint[], startY: number, width: number): number => {
    if (!arc || arc.length === 0) return startY;

    let y = startY;
    const height = 45;
    const bottomY = y + height;
    
    // Container
    doc.setDrawColor(COLORS.GRAY_LIGHT);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(MARGIN, y, width, height + 15, 2, 2, 'FD');
    
    // Title
    doc.setFontSize(FONTS.SMALL);
    doc.setTextColor(COLORS.GRAY_MEDIUM);
    doc.text("Narrative Arc", MARGIN + 5, y + 5);

    y += 5;

    // Axes
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.5);
    doc.line(MARGIN + 10, bottomY, MARGIN + width - 10, bottomY); // X
    doc.line(MARGIN + 10, y + 5, MARGIN + 10, bottomY); // Y

    // Plotting
    const maxX = 100;
    const maxY = 10;
    const plotW = width - 20;
    const plotX = MARGIN + 10;
    
    const getX = (val: number) => plotX + (val / maxX) * plotW;
    const getY = (val: number) => bottomY - (val / maxY) * (height - 5);

    const sorted = [...arc].sort((a, b) => (a.x || 0) - (b.x || 0));

    const drawCurve = (key: 'tension' | 'emotion' | 'conflict', color: string) => {
        doc.setDrawColor(color);
        doc.setLineWidth(0.7);
        let lastX = -1, lastY = -1;
        
        sorted.forEach(p => {
            const px = getX(p.x || 0);
            const py = getY((p as any)[key]);
            
            if (lastX !== -1) {
                doc.line(lastX, lastY, px, py);
            }
            lastX = px;
            lastY = py;
            
            // Dot
            doc.setFillColor(color);
            doc.circle(px, py, 0.8, 'F');
        });
    };

    drawCurve('tension', '#ef4444');
    drawCurve('emotion', '#06b6d4');
    drawCurve('conflict', '#f59e0b');

    // Legend
    const legY = bottomY + 8;
    doc.setFontSize(FONTS.TINY);
    doc.setTextColor('#ef4444'); doc.text("● Tension", MARGIN + 15, legY);
    doc.setTextColor('#06b6d4'); doc.text("● Emotion", MARGIN + 45, legY);
    doc.setTextColor('#f59e0b'); doc.text("● Conflict", MARGIN + 75, legY);

    return bottomY + 20; 
};

const getValidTechFields = (shot: Shot, t: (key: string) => string) => {
    return [
        { l: t('cameraMovement'), v: shot.cameraMovement },
        { l: t('cameraType'), v: shot.cameraType },
        { l: t('lensType'), v: shot.lensType },
        { l: t('lightingScheme'), v: shot.lighting },
        { l: t('soundFx'), v: shot.soundFx },
        { l: t('style'), v: shot.style },
        { l: t('atmosphere'), v: shot.atmosphere },
    ].filter(f => f.v && f.v !== 'None' && f.v !== 'Unassigned' && f.v !== 'Default' && f.v !== 'N/A');
};

const calculateShotHeight = (doc: jsPDF, shot: Shot, width: number, includeTech: boolean, t: (key: string) => string): number => {
    const imgHeight = width * (9/16);
    const headerHeight = 10; // Shot type + duration
    const descHeight = getTextHeight(doc, shot.description, width, FONTS.BODY) + 5;
    
    let techHeight = 0;
    if (includeTech) {
        const validFields = getValidTechFields(shot, t);
        if (validFields.length > 0) {
            const boxPadding = 3;
            const rowHeight = 4;
            const rows = Math.ceil(validFields.length / 2); 
            const boxHeight = (rows * rowHeight) + (boxPadding * 2) + 2;
            techHeight = boxHeight + 4; // + margin
        }
    }
    
    return imgHeight + headerHeight + descHeight + techHeight + 5; // + padding
};

const drawShotCard = (
    doc: jsPDF, 
    shot: Shot, 
    index: number, 
    x: number, 
    y: number, 
    width: number, 
    t: (key: string) => string,
    options: PDFExportOptions
): number => {
    const startY = y;
    let currentY = y;

    // 1. IMAGE
    const imgHeight = width * (9/16);
    doc.setFillColor(240, 240, 240);
    doc.rect(x, currentY, width, imgHeight, 'F'); // Placeholder

    if (shot.imageUrl && shot.imageUrl.startsWith('data:')) {
        try {
            doc.addImage(shot.imageUrl, 'PNG', x, currentY, width, imgHeight, undefined, 'FAST');
        } catch (e) {
            // Fallback text if image fails (e.g. corrupt base64)
            doc.setFontSize(FONTS.TINY);
            doc.setTextColor(COLORS.GRAY_MEDIUM);
            doc.text(t('pdfImageNotAvailable'), x + width/2, currentY + imgHeight/2, { align: 'center' });
        }
    } else {
        doc.setFontSize(FONTS.TINY);
        doc.setTextColor(COLORS.GRAY_MEDIUM);
        doc.text(t('noImage'), x + width/2, currentY + imgHeight/2, { align: 'center' });
    }
    
    // Shot Number Tag
    doc.setFillColor(COLORS.ACCENT);
    doc.rect(x, currentY, 12, 6, 'F');
    doc.setTextColor('#FFFFFF');
    doc.setFontSize(FONTS.TINY);
    doc.setFont('helvetica', 'bold');
    doc.text(`${index}`, x + 6, currentY + 4, { align: 'center' });

    // Duration Tag
    doc.setFillColor(COLORS.BLACK); // Use solid black instead of rgba
    const durText = `${shot.duration}s`;
    const durW = doc.getTextWidth(durText) + 4;
    doc.rect(x + width - durW, currentY + imgHeight - 6, durW, 6, 'F');
    doc.text(durText, x + width - durW/2, currentY + imgHeight - 2, { align: 'center' });

    currentY += imgHeight + 4;

    // 2. HEADER
    doc.setTextColor(COLORS.ACCENT);
    doc.setFontSize(FONTS.BODY);
    doc.setFont('helvetica', 'bold');
    doc.text(shot.shotType || t('shot'), x, currentY);
    currentY += 5;

    // 3. DESCRIPTION
    currentY = printWrappedText(doc, shot.description, x, currentY, width, FONTS.BODY, 'normal', COLORS.BLACK);
    currentY += 2;

    // 4. TECHNICAL DETAILS
    if (options.includeTechDetails) {
        const techFields = getValidTechFields(shot, t);

        if (techFields.length > 0) {
            // Background box
            const boxPadding = 3;
            const rowHeight = 4;
            // Calculate box height based on items
            const rows = Math.ceil(techFields.length / 2); // 2 cols
            const boxHeight = (rows * rowHeight) + (boxPadding * 2) + 2;

            doc.setFillColor(COLORS.BG_LIGHT);
            doc.roundedRect(x, currentY, width, boxHeight, 1, 1, 'F');
            
            let innerY = currentY + boxPadding + 3;
            const colW = (width - (boxPadding*2)) / 2;

            techFields.forEach((field, idx) => {
                const isRight = idx % 2 !== 0;
                const colX = isRight ? x + boxPadding + colW : x + boxPadding;
                
                // Label
                doc.setFontSize(FONTS.TINY);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(COLORS.GRAY_MEDIUM);
                doc.text(field.l.substring(0, 12) + ":", colX, innerY);
                
                // Value
                doc.setTextColor(COLORS.GRAY_DARK);
                doc.setFont('helvetica', 'normal');
                const valX = colX + doc.getTextWidth(field.l.substring(0, 12) + ": ");
                
                // Simple truncation
                let valText = field.v;
                if (doc.getTextWidth(valText) > (colW - 25)) {
                    valText = valText.substring(0, 15) + "...";
                }
                doc.text(valText, valX, innerY);

                if (isRight) innerY += rowHeight;
            });
            
            currentY += boxHeight + 4;
        }
    }

    return currentY - startY;
};

// --- MAIN EXPORT FUNCTION ---

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
    options: PDFExportOptions
) => {
    try {
        const doc = new jsPDF();
        let currentY = MARGIN;

        const checkBreak = (heightNeeded: number) => {
            if (currentY + heightNeeded > PAGE_HEIGHT - MARGIN) {
                doc.addPage();
                currentY = MARGIN;
                return true;
            }
            return false;
        };

        // --- 1. COVER PAGE ---
        if (options.includeCover) {
            currentY += 60;
            
            // Title
            doc.setFontSize(FONTS.TITLE + 6);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(COLORS.BLACK);
            const titleLines = doc.splitTextToSize(title.toUpperCase(), CONTENT_WIDTH);
            doc.text(titleLines, PAGE_WIDTH / 2, currentY, { align: 'center' });
            currentY += (titleLines.length * 12) + 10;

            // Subtitle / Author
            if (author) {
                doc.setFontSize(FONTS.HEADER);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(COLORS.GRAY_DARK);
                doc.text(t('pdfByAuthor').replace('{authorName}', author), PAGE_WIDTH / 2, currentY, { align: 'center' });
                currentY += 40;
            }

            // Metadata Table
            if (options.includeMetadata) {
                const startX = PAGE_WIDTH / 2 - 70;
                const col1 = startX;
                const col2 = startX + 80;
                
                const drawRow = (lbl: string, val: string) => {
                    doc.setFontSize(FONTS.BODY);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(COLORS.BLACK);
                    doc.text(lbl, col1, currentY);
                    
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(COLORS.GRAY_DARK);
                    doc.text(val, col2, currentY);
                    
                    doc.setDrawColor(COLORS.GRAY_LIGHT);
                    doc.line(col1, currentY + 2, col2 + 50, currentY + 2);
                    currentY += 10;
                };

                drawRow(t('storyboardStyleLabel'), style);
                drawRow(t('aspectRatioLabel'), aspectRatio);
                drawRow(t('episodes'), episodes.length.toString());
                drawRow(t('characters'), characters.length.toString());
                drawRow(t('pdfGeneratedOn'), new Date().toLocaleDateString());
            }

            doc.addPage();
            currentY = MARGIN;
        }

        // --- 2. STORY BIBLE ---
        if (options.includeBible) {
            doc.setFontSize(FONTS.TITLE);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(COLORS.ACCENT);
            doc.text(t('outlineTab'), MARGIN, currentY);
            currentY += 15;

            // Logline Box
            doc.setFillColor(COLORS.BG_LIGHT);
            doc.setDrawColor(COLORS.ACCENT);
            doc.rect(MARGIN, currentY, CONTENT_WIDTH, 25, 'FD');
            
            doc.setFontSize(FONTS.SUBHEADER);
            doc.setTextColor(COLORS.ACCENT);
            doc.text(t('logline').toUpperCase(), MARGIN + 5, currentY + 8);
            
            const logY = currentY + 15;
            printWrappedText(doc, logline, MARGIN + 5, logY, CONTENT_WIDTH - 10, FONTS.BODY, 'italic', COLORS.GRAY_DARK);
            currentY += 35;

            // Narrative Arc
            if (options.includeNarrativeArc && narrativeArc.length > 0) {
                checkBreak(60);
                currentY = drawNarrativeArc(doc, narrativeArc, currentY, CONTENT_WIDTH);
                currentY += 10;
            }

            // Structural Analysis
            if (structuralAnalysis) {
                checkBreak(60);
                doc.setFontSize(FONTS.HEADER);
                doc.setTextColor(COLORS.BLACK);
                doc.text(t('structuralAnalysis'), MARGIN, currentY);
                currentY += 8;
                currentY = printWrappedText(doc, structuralAnalysis, MARGIN, currentY, CONTENT_WIDTH, FONTS.BODY);
                currentY += 10;
            }

            // Treatment
            if (treatment) {
                checkBreak(60);
                doc.setFontSize(FONTS.HEADER);
                doc.setTextColor(COLORS.BLACK);
                doc.text(t('treatment'), MARGIN, currentY);
                currentY += 8;
                currentY = printWrappedText(doc, treatment, MARGIN, currentY, CONTENT_WIDTH, FONTS.BODY);
                currentY += 10;
            }

            doc.addPage();
            currentY = MARGIN;
        }

        // --- 3. CHARACTERS ---
        if (options.includeCharacters && characters.length > 0) {
            doc.setFontSize(FONTS.TITLE);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(COLORS.ACCENT);
            doc.text(t('characters'), MARGIN, currentY);
            currentY += 15;

            for (const char of characters) {
                checkBreak(65);

                // Card
                doc.setDrawColor(COLORS.BORDER);
                doc.setFillColor(255, 255, 255);
                doc.roundedRect(MARGIN, currentY, CONTENT_WIDTH, 60, 2, 2, 'FD');

                // Image
                if (char.images.length > 0 && char.images[0].startsWith('data:')) {
                    try {
                        doc.addImage(char.images[0], 'PNG', MARGIN + 2, currentY + 2, 35, 56, undefined, 'FAST');
                    } catch(e) {}
                } else {
                    doc.setFillColor(COLORS.BG_LIGHT);
                    doc.rect(MARGIN + 2, currentY + 2, 35, 56, 'F');
                }

                // Data
                const textX = MARGIN + 42;
                let textY = currentY + 10;
                const textW = CONTENT_WIDTH - 45;

                doc.setFontSize(FONTS.HEADER);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(COLORS.BLACK);
                doc.text(char.name, textX, textY);
                
                doc.setFontSize(FONTS.BODY);
                doc.setFont('helvetica', 'italic');
                doc.setTextColor(COLORS.GRAY_MEDIUM);
                doc.text(char.role, textX + doc.getTextWidth(char.name) + 3, textY);
                
                textY += 10;

                const printField = (label: string, val: string) => {
                    doc.setFontSize(FONTS.SMALL);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(COLORS.GRAY_DARK);
                    doc.text(label + ": ", textX, textY);
                    const lw = doc.getTextWidth(label + ": ");
                    
                    doc.setFont('helvetica', 'normal');
                    const lines = doc.splitTextToSize(val, textW - lw);
                    doc.text(lines, textX + lw, textY);
                    textY += (lines.length * 4) + 2;
                };

                printField(t('pdfPersonality'), char.personality);
                printField(t('pdfAppearance'), char.appearance);
                printField(t('characterOutfit'), char.outfit);

                currentY += 65;
            }
            doc.addPage();
            currentY = MARGIN;
        }

        // --- 4. EPISODES (STORYBOARD) ---
        const episodesToExport = options.includeAllEpisodes 
            ? episodes 
            : episodes.filter(e => e.id === activeEpisodeId);

        for (const ep of episodesToExport) {
            if (currentY !== MARGIN) {
                doc.addPage();
                currentY = MARGIN;
            }

            // Episode Header
            doc.setFillColor(COLORS.BLACK);
            doc.rect(0, currentY - 10, PAGE_WIDTH, 25, 'F');
            
            doc.setTextColor('#FFFFFF');
            doc.setFontSize(FONTS.TITLE);
            doc.setFont('helvetica', 'bold');
            doc.text(ep.title, MARGIN, currentY + 8);
            currentY += 25;

            // Synopsis
            if (ep.synopsis) {
                doc.setFontSize(FONTS.SUBHEADER);
                doc.setTextColor(COLORS.ACCENT);
                doc.setFont('helvetica', 'bold');
                doc.text("Synopsis", MARGIN, currentY);
                currentY += 6;
                currentY = printWrappedText(doc, ep.synopsis, MARGIN, currentY, CONTENT_WIDTH, FONTS.BODY, 'italic', COLORS.GRAY_DARK);
                currentY += 15;
            }

            for (const [sIndex, scene] of ep.scenes.entries()) {
                checkBreak(40);

                // Scene Header
                doc.setDrawColor(COLORS.ACCENT);
                doc.setLineWidth(0.8);
                doc.line(MARGIN, currentY, MARGIN + CONTENT_WIDTH, currentY);
                currentY += 6;

                doc.setFontSize(FONTS.HEADER);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(COLORS.BLACK);
                doc.text(`${t('scene')} ${sIndex + 1}: ${scene.title}`, MARGIN, currentY);
                
                doc.setFontSize(FONTS.SMALL);
                doc.setTextColor(COLORS.GRAY_MEDIUM);
                const locInfo = `${scene.location || ''} ${scene.setting ? `| ${scene.setting}` : ''}`;
                doc.text(locInfo, MARGIN + CONTENT_WIDTH - doc.getTextWidth(locInfo), currentY);
                currentY += 8;

                if (scene.actions) {
                    currentY = printWrappedText(doc, scene.actions, MARGIN, currentY, CONTENT_WIDTH, FONTS.BODY, 'normal', COLORS.GRAY_DARK);
                    currentY += 8;
                }

                // SHOTS LAYOUT
                const gap = 6;
                if (options.layout === 'compact') {
                    // 2 Columns
                    const colWidth = (CONTENT_WIDTH - gap) / 2;
                    
                    for (let i = 0; i < scene.shots.length; i += 2) {
                        const shotA = scene.shots[i];
                        const shotB = scene.shots[i+1];

                        // Calculate Max Height Needed for this Row
                        const heightA = calculateShotHeight(doc, shotA, colWidth, options.includeTechDetails, t);
                        const heightB = shotB ? calculateShotHeight(doc, shotB, colWidth, options.includeTechDetails, t) : 0;
                        const rowHeight = Math.max(heightA, heightB);

                        if (checkBreak(rowHeight + 10)) {
                            // If break, we are at top of new page
                        }

                        const rowStartY = currentY;

                        // Draw A
                        const usedA = drawShotCard(doc, shotA, i+1, MARGIN, rowStartY, colWidth, t, options);
                        
                        // Draw B
                        let usedB = 0;
                        if (shotB) {
                            usedB = drawShotCard(doc, shotB, i+2, MARGIN + colWidth + gap, rowStartY, colWidth, t, options);
                        }

                        currentY += Math.max(usedA, usedB) + gap + 5;
                    }

                } else {
                    // 1 Column (Standard)
                    const shotWidth = CONTENT_WIDTH * 0.8;
                    const shotX = MARGIN + (CONTENT_WIDTH - shotWidth) / 2;

                    for (const [i, shot] of scene.shots.entries()) {
                        const estHeight = calculateShotHeight(doc, shot, shotWidth, options.includeTechDetails, t);
                        checkBreak(estHeight + 10);

                        const usedH = drawShotCard(doc, shot, i+1, shotX, currentY, shotWidth, t, options);
                        currentY += usedH + gap + 5;
                    }
                }
                
                currentY += 10; // Space between scenes
            }
        }

        // --- 5. REFERENCES ---
        if (options.includeReferences && references.length > 0) {
            doc.addPage();
            currentY = MARGIN;
            doc.setFontSize(FONTS.TITLE);
            doc.setTextColor(COLORS.BLACK);
            doc.text(t('references'), MARGIN, currentY);
            currentY += 15;

            references.forEach(ref => {
                checkBreak(30);
                doc.setTextColor(COLORS.ACCENT);
                doc.setFontSize(FONTS.SUBHEADER);
                
                // Safe link handling
                doc.text(ref.title, MARGIN, currentY);
                const w = doc.getTextWidth(ref.title);
                doc.link(MARGIN, currentY - 5, w, 6, { url: ref.uri });

                currentY += 6;
                currentY = printWrappedText(doc, ref.description, MARGIN, currentY, CONTENT_WIDTH, FONTS.SMALL, 'normal', COLORS.GRAY_DARK);
                currentY += 8;
            });
        }

        // --- 6. FOOTER ---
        const totalPages = doc.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(COLORS.GRAY_LIGHT);
            doc.text(`${t('pdfPageInfo').replace('{page}', i.toString()).replace('{total}', totalPages.toString())}`, PAGE_WIDTH / 2, PAGE_HEIGHT - 10, { align: 'center' });
        }

        const safeName = (title.replace(/[^a-z0-9]/gi, '_') || 'Storyboard');
        doc.save(`${safeName}.pdf`);
        
    } catch (e) {
        console.error("PDF Generation Error:", e);
        alert("Failed to generate PDF. Please check the console for details.\nError: " + (e as Error).message);
    }
};
