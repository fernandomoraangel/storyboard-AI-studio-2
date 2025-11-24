
import { jsPDF } from 'jspdf';
import type { Scene, Character, Shot, StoryboardStyle, Reference, Episode, ArcPoint } from '../types';
import type { PDFExportOptions } from '../components/PDFExportModal';

const MARGIN = 15;
const FONT_SIZES = {
    H1: 24,
    H2: 16,
    H3: 12,
    BODY: 10,
    LABEL: 9,
    TINY: 7,
    FOOTER: 9,
};
const COLORS = {
    BLACK: '#000000',
    GRAY_DARK: '#333333',
    GRAY_MEDIUM: '#666666',
    GRAY_LIGHT: '#CCCCCC',
    BACKGROUND_LIGHT: '#F3F4F6',
    PROMPT: '#555555',
    RED: '#EF4444',
    CYAN: '#06B6D4',
    ORANGE: '#F59E0B',
};

const getImageDimensions = (dataUrl: string): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.width, height: img.height });
        img.onerror = reject;
        img.src = dataUrl;
    });
};

// Helper to add new page with footer
const checkPageBreak = (doc: jsPDF, currentY: number, threshold: number): number => {
    if (currentY > doc.internal.pageSize.height - threshold) {
        doc.addPage();
        return MARGIN;
    }
    return currentY;
};

const drawNarrativeArc = (doc: jsPDF, arc: ArcPoint[], startY: number, width: number): number => {
    if (!arc || arc.length === 0) return startY;

    let y = startY;
    const height = 60;
    const bottomY = y + height;
    const plotWidth = width;
    
    // Background
    doc.setFillColor(250, 250, 250);
    doc.rect(MARGIN, y, plotWidth, height, 'F');
    
    // Axes
    doc.setDrawColor(200, 200, 200);
    doc.line(MARGIN, bottomY, MARGIN + plotWidth, bottomY); // X
    doc.line(MARGIN, y, MARGIN, bottomY); // Y

    // Labels
    doc.setFontSize(FONT_SIZES.TINY);
    doc.setTextColor(COLORS.GRAY_MEDIUM);
    
    // Plot Points
    const sortedPoints = [...arc].sort((a, b) => (a.x || 0) - (b.x || 0));
    const maxX = 100;
    const maxY = 10;

    // Helper to map coordinates
    const getX = (val: number) => MARGIN + (val / maxX) * plotWidth;
    const getY = (val: number) => bottomY - (val / maxY) * height;

    const curves = [
        { key: 'tension', color: COLORS.RED, label: 'Tension' },
        { key: 'emotion', color: COLORS.CYAN, label: 'Emotion' },
        { key: 'conflict', color: COLORS.ORANGE, label: 'Conflict' }
    ];

    curves.forEach((curve, idx) => {
        doc.setDrawColor(curve.color);
        doc.setLineWidth(0.5);
        
        for (let i = 0; i < sortedPoints.length - 1; i++) {
            const p1 = sortedPoints[i];
            const p2 = sortedPoints[i+1];
            
            const x1 = getX(p1.x || 0);
            const y1 = getY((p1 as any)[curve.key]);
            const x2 = getX(p2.x || 0);
            const y2 = getY((p2 as any)[curve.key]);
            
            doc.line(x1, y1, x2, y2);
        }

        // Legend
        doc.setTextColor(curve.color);
        doc.text(curve.label, MARGIN + (idx * 40), bottomY + 5);
    });

    doc.setTextColor(COLORS.BLACK);
    return bottomY + 15;
};

const drawReferences = (doc: jsPDF, references: Reference[], startY: number): number => {
    if (!references || references.length === 0) return startY;

    let y = startY;
    doc.setFontSize(FONT_SIZES.H2);
    doc.text("References", MARGIN, y);
    y += 10;

    doc.setFontSize(FONT_SIZES.BODY);
    references.forEach(ref => {
        y = checkPageBreak(doc, y, 30);
        
        // Title (Link)
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 0, 255);
        doc.textWithLink(ref.title, MARGIN, y, { url: ref.uri });
        doc.setTextColor(COLORS.BLACK);
        y += 5;

        // Description
        doc.setFont("helvetica", "normal");
        const descLines = doc.splitTextToSize(ref.description, 180);
        doc.text(descLines, MARGIN, y);
        y += (descLines.length * 5) + 5;
    });

    return y;
};

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
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentWidth = pageWidth - (MARGIN * 2);
    let y = MARGIN;

    // --- COVER PAGE ---
    if (options.includeCover) {
        y = pageHeight / 3;
        doc.setFontSize(FONT_SIZES.H1);
        doc.setFont("helvetica", "bold");
        doc.text(title, pageWidth / 2, y, { align: "center" });
        y += 15;
        
        if (author) {
            doc.setFontSize(FONT_SIZES.H3);
            doc.setFont("helvetica", "normal");
            doc.text(t('pdfByAuthor').replace('{authorName}', author), pageWidth / 2, y, { align: "center" });
            y += 20;
        }

        doc.setFontSize(FONT_SIZES.BODY);
        doc.setTextColor(COLORS.GRAY_MEDIUM);
        doc.text(`${t('pdfGeneratedOn')}: ${new Date().toLocaleDateString()}`, pageWidth / 2, y, { align: "center" });
        
        if (options.includeMetadata) {
            y = pageHeight - 50;
            doc.setFontSize(FONT_SIZES.TINY);
            doc.text(`${t('storyboardStyleLabel')}: ${style}`, pageWidth / 2, y, { align: "center" });
            y += 5;
            doc.text(`${t('aspectRatioLabel')}: ${aspectRatio}`, pageWidth / 2, y, { align: "center" });
            y += 5;
            doc.text(`${t('characters')}: ${characters.length}`, pageWidth / 2, y, { align: "center" });
        }
        
        doc.addPage();
        y = MARGIN;
        doc.setTextColor(COLORS.BLACK);
    }

    // --- STORY BIBLE ---
    if (options.includeBible) {
        doc.setFontSize(FONT_SIZES.H2);
        doc.setFont("helvetica", "bold");
        doc.text(t('outlineTab'), MARGIN, y);
        y += 10;

        doc.setFontSize(FONT_SIZES.H3);
        doc.text(t('logline'), MARGIN, y);
        y += 6;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(FONT_SIZES.BODY);
        const loglineLines = doc.splitTextToSize(logline, contentWidth);
        doc.text(loglineLines, MARGIN, y);
        y += (loglineLines.length * 5) + 10;

        doc.setFontSize(FONT_SIZES.H3);
        doc.setFont("helvetica", "bold");
        doc.text(t('treatment'), MARGIN, y);
        y += 6;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(FONT_SIZES.BODY);
        const treatmentLines = doc.splitTextToSize(treatment, contentWidth);
        doc.text(treatmentLines, MARGIN, y);
        y += (treatmentLines.length * 5) + 10;

        // NARRATIVE ARC (Inserted here as requested)
        if (options.includeNarrativeArc && narrativeArc.length > 0) {
            y = checkPageBreak(doc, y, 80);
            doc.setFontSize(FONT_SIZES.H3);
            doc.setFont("helvetica", "bold");
            doc.text(t('narrativeArcTitle'), MARGIN, y);
            y += 8;
            y = drawNarrativeArc(doc, narrativeArc, y, contentWidth);
            y += 10;
        }

        if (structuralAnalysis) {
            y = checkPageBreak(doc, y, 50);
            doc.setFontSize(FONT_SIZES.H3);
            doc.setFont("helvetica", "bold");
            doc.text(t('structuralAnalysis'), MARGIN, y);
            y += 6;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(FONT_SIZES.BODY);
            const structLines = doc.splitTextToSize(structuralAnalysis, contentWidth);
            doc.text(structLines, MARGIN, y);
            y += (structLines.length * 5) + 10;
        }

        if (soundtrackPrompt) {
            y = checkPageBreak(doc, y, 30);
            doc.setFontSize(FONT_SIZES.H3);
            doc.setFont("helvetica", "bold");
            doc.text(t('pdfSoundtrackPrompt'), MARGIN, y);
            y += 6;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(FONT_SIZES.BODY);
            const soundLines = doc.splitTextToSize(soundtrackPrompt, contentWidth);
            doc.text(soundLines, MARGIN, y);
            y += (soundLines.length * 5) + 15;
        }
        
        doc.addPage();
        y = MARGIN;
    }

    // --- CHARACTERS ---
    if (options.includeCharacters && characters.length > 0) {
        doc.setFontSize(FONT_SIZES.H2);
        doc.setFont("helvetica", "bold");
        doc.text(t('characters'), MARGIN, y);
        y += 10;

        for (const char of characters) {
            y = checkPageBreak(doc, y, 60);
            
            // Character Name & Role
            doc.setFontSize(FONT_SIZES.H3);
            doc.setFont("helvetica", "bold");
            doc.text(`${char.name} (${char.role})`, MARGIN, y);
            y += 6;

            // Details
            doc.setFontSize(FONT_SIZES.BODY);
            doc.setFont("helvetica", "normal");
            
            const details = [
                `${t('pdfPersonality')}: ${char.personality}`,
                `${t('pdfAppearance')}: ${char.appearance}`,
                `${t('characterOutfit')}: ${char.outfit}`
            ];

            details.forEach(detail => {
                const lines = doc.splitTextToSize(detail, contentWidth);
                doc.text(lines, MARGIN, y);
                y += (lines.length * 5) + 2;
            });

            // Image (First available)
            if (char.images && char.images.length > 0) {
                const imgData = char.images[0];
                if (imgData.startsWith('data:image')) {
                    try {
                        const dims = await getImageDimensions(imgData);
                        const imgHeight = 50;
                        const imgWidth = (dims.width / dims.height) * imgHeight;
                        
                        if (y + imgHeight > pageHeight - MARGIN) {
                            doc.addPage();
                            y = MARGIN;
                        }
                        
                        doc.addImage(imgData, 'PNG', MARGIN, y, imgWidth, imgHeight);
                        y += imgHeight + 5;
                    } catch (e) {
                        console.warn("Failed to add character image to PDF", e);
                    }
                }
            }
            y += 10;
        }
        doc.addPage();
        y = MARGIN;
    }

    // --- EPISODES & STORYBOARD ---
    const episodesToExport = options.includeAllEpisodes 
        ? episodes 
        : episodes.filter(e => e.id === activeEpisodeId);

    for (const ep of episodesToExport) {
        doc.setFontSize(FONT_SIZES.H2);
        doc.setFont("helvetica", "bold");
        doc.text(ep.title, MARGIN, y);
        y += 8;
        
        doc.setFontSize(FONT_SIZES.BODY);
        doc.setFont("helvetica", "italic");
        const synLines = doc.splitTextToSize(ep.synopsis, contentWidth);
        doc.text(synLines, MARGIN, y);
        y += (synLines.length * 5) + 10;

        for (const [sIndex, scene] of ep.scenes.entries()) {
            y = checkPageBreak(doc, y, 40);
            
            // Scene Header
            doc.setFillColor(COLORS.GRAY_DARK);
            doc.rect(MARGIN, y, contentWidth, 8, 'F');
            doc.setTextColor('#FFFFFF');
            doc.setFont("helvetica", "bold");
            doc.setFontSize(FONT_SIZES.H3);
            doc.text(`${t('scene')} ${sIndex + 1}: ${scene.title}`, MARGIN + 2, y + 6);
            doc.setTextColor(COLORS.BLACK);
            y += 12;

            // Scene Metadata
            doc.setFontSize(FONT_SIZES.LABEL);
            doc.setFont("helvetica", "bold");
            doc.text(`${scene.location} | ${scene.setting}`, MARGIN, y);
            y += 5;
            
            doc.setFont("helvetica", "normal");
            const actionLines = doc.splitTextToSize(scene.actions, contentWidth);
            doc.text(actionLines, MARGIN, y);
            y += (actionLines.length * 4) + 5;

            // SHOTS
            for (const [shIndex, shot] of scene.shots.entries()) {
                const shotHeight = options.layout === 'compact' ? 70 : 100; 
                y = checkPageBreak(doc, y, shotHeight);

                const shotWidth = options.layout === 'compact' ? (contentWidth / 2) - 5 : contentWidth * 0.6;
                const textX = options.layout === 'compact' ? MARGIN : MARGIN + shotWidth + 5;
                
                // Image
                if (shot.imageUrl && shot.imageUrl.startsWith('data:image')) {
                    try {
                        // Calculate 16:9 usually
                        const displayH = shotWidth * (9/16);
                        doc.addImage(shot.imageUrl, 'PNG', MARGIN, y, shotWidth, displayH);
                        // Draw border
                        doc.setDrawColor(COLORS.GRAY_LIGHT);
                        doc.rect(MARGIN, y, shotWidth, displayH);
                    } catch (e) {
                        // Placeholder
                        doc.setFillColor(COLORS.BACKGROUND_LIGHT);
                        doc.rect(MARGIN, y, shotWidth, shotWidth * (9/16), 'F');
                        doc.setFontSize(FONT_SIZES.TINY);
                        doc.text(t('pdfImageNotAvailable'), MARGIN + 5, y + 20);
                    }
                } else {
                    // Placeholder box
                    doc.setFillColor(COLORS.BACKGROUND_LIGHT);
                    doc.rect(MARGIN, y, shotWidth, shotWidth * (9/16), 'F');
                    doc.setFontSize(FONT_SIZES.TINY);
                    doc.text(t('pdfImageNotAvailable'), MARGIN + 5, y + 20);
                }

                // Text Info
                let infoY = options.layout === 'compact' ? y + (shotWidth * (9/16)) + 5 : y;
                const infoWidth = options.layout === 'compact' ? shotWidth : (contentWidth - shotWidth - 5);
                const infoX = options.layout === 'compact' ? MARGIN : MARGIN + shotWidth + 5;

                doc.setFontSize(FONT_SIZES.H3);
                doc.setFont("helvetica", "bold");
                doc.text(`${t('shot')} ${shIndex + 1}`, infoX, infoY + 4);
                infoY += 8;

                doc.setFontSize(FONT_SIZES.BODY);
                doc.setFont("helvetica", "normal");
                const desc = doc.splitTextToSize(shot.description, infoWidth);
                doc.text(desc, infoX, infoY);
                infoY += (desc.length * 5) + 3;

                // Tech Details (Conditional)
                if (options.includeTechDetails) {
                    doc.setFontSize(FONT_SIZES.TINY);
                    doc.setTextColor(COLORS.GRAY_MEDIUM);
                    
                    const techLines = [
                        `${t('shotType')}: ${shot.shotType}`,
                        `${t('cameraMovement')}: ${shot.cameraMovement}`,
                        `${t('lensType')}: ${shot.lensType}`,
                        `${t('lightingScheme')}: ${shot.lighting}`,
                    ];
                    
                    techLines.forEach(line => {
                        doc.text(line, infoX, infoY);
                        infoY += 3.5;
                    });
                    doc.setTextColor(COLORS.BLACK);
                }

                y += options.layout === 'compact' ? (shotWidth * (9/16)) + 40 : shotHeight; // increment Y for next shot
                
                // If compact and even index (0, 2...), we might want to put next shot on same row, but for simplicity in this
                // robust implementation, I am sticking to a vertical flow.
                // To implement true 2-column grid in PDF is complex with variable text height. 
                // The "Compact" option here just reduces image size to save vertical space.
            }
            y += 10; // Space between scenes
        }
        doc.addPage();
        y = MARGIN;
    }

    // --- REFERENCES (At the end) ---
    if (options.includeReferences && references.length > 0) {
        drawReferences(doc, references, y);
    }

    doc.save(`${title.replace(/ /g, '_')}_Storyboard.pdf`);
};
