
import { jsPDF } from 'jspdf';
import type { Scene, Character, Shot, StoryboardStyle, Reference, Episode } from '../types';
import { createImagePromptForShot, createCharacterImagePrompt } from './geminiService';
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
};

const getImageDimensions = (dataUrl: string): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            resolve({ width: img.width, height: img.height });
        };
        img.onerror = (err) => {
            console.error("Failed to load image for dimension check:", err);
            resolve({ width: 16, height: 9 });
        };
        img.src = dataUrl;
    });
};

const parseAspectRatio = (ratioStr: string): number => {
    if (!ratioStr) return 16 / 9;
    const parts = ratioStr.split(':');
    if (parts.length === 2) {
        const [w, h] = parts.map(parseFloat);
        return h > 0 ? w / h : 16 / 9;
    }
    const singleNum = parseFloat(ratioStr);
    return singleNum > 0 ? singleNum : 16 / 9;
};

const getPortraitRatio = (ratio: string): string => {
    if (!ratio) return '9:16';
    const parts = ratio.split(':');
    if (parts.length === 2) {
        const [w, h] = parts.map(parseFloat);
        if (w > h) return `${h}:${w}`;
    } else {
        const w = parseFloat(ratio);
        if (w > 1) return `1:${w}`;
    }
    return ratio;
};

const addImageToDoc = async (doc: jsPDF, imageData: string | null, x: number, y: number, containerWidth: number, containerHeight: number, t: (key: any) => string) => {
    try {
        if (!imageData || !(imageData.startsWith('data:image/') || imageData.startsWith('blob:'))) {
            throw new Error("Invalid or missing image data");
        }
        
        const { width: imgWidth, height: imgHeight } = await getImageDimensions(imageData);
        const imgAspect = imgWidth / imgHeight;
        const containerAspect = containerWidth / containerHeight;

        let drawW = containerWidth;
        let drawH = containerHeight;
        let drawX = x;
        let drawY = y;

        if (imgAspect > containerAspect) { 
            drawH = containerWidth / imgAspect;
            drawY = y + (containerHeight - drawH) / 2; 
        } else { 
            drawW = containerHeight * imgAspect;
            drawX = x + (containerWidth - drawW) / 2; 
        }

        doc.addImage(imageData, 'JPEG', drawX, drawY, drawW, drawH);

    } catch (e) {
        doc.setDrawColor(200);
        doc.setFillColor(245, 245, 245);
        doc.rect(x, y, containerWidth, containerHeight, 'FD');
        doc.setTextColor(150);
        doc.setFontSize(8);
        const text = t('pdfImageNotAvailable');
        const textWidth = doc.getTextWidth(text);
        doc.text(text, x + containerWidth / 2 - textWidth / 2, y + containerHeight / 2);
    }
};

const addLabeledBlock = (
    doc: jsPDF,
    label: string,
    value: string,
    currentY: number,
    contentW: number,
    checkPageBreak: (y: number, h: number) => number,
    options: { isPrompt?: boolean } = {}
): number => {
    if (!value || value.trim() === 'N/A' || value.trim() === '') {
        return currentY;
    }

    let y = currentY;
    const fontSize = options.isPrompt ? FONT_SIZES.TINY : FONT_SIZES.BODY;
    doc.setFontSize(fontSize);
    
    const lineHeightFactor = 1.2;
    const lineHeight = (doc.getLineHeight() / doc.internal.scaleFactor) * lineHeightFactor;

    doc.setFont('helvetica', 'bold');
    const labelWidth = doc.getTextWidth(label + ': ');
    
    // Calculate available width for value
    const valueWidth = contentW; // Full width for value block below label
    // Or full width if inline? Let's stick to block: Label \n Value
    
    // Split text
    const lines = doc.splitTextToSize(value, contentW);
    const textHeight = lines.length * lineHeight;
    const totalHeight = lineHeight + textHeight + 2; // Label line + text lines + padding

    y = checkPageBreak(y, totalHeight);

    // Draw Label
    doc.setTextColor(COLORS.BLACK);
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, MARGIN, y);
    y += lineHeight;

    // Draw Value
    doc.setTextColor(options.isPrompt ? COLORS.PROMPT : COLORS.GRAY_DARK);
    doc.setFont('helvetica', options.isPrompt ? 'italic' : 'normal');
    doc.text(lines, MARGIN, y);
    
    return y + textHeight + 3; // Return new Y with padding
};

const addSideBySideBlocks = (
    doc: jsPDF,
    leftLabel: string,
    leftValue: string,
    rightLabel: string,
    rightValue: string,
    y: number,
    pageW: number,
    margin: number,
    checkPageBreak: (y: number, h: number) => number
): number => {
    const contentW = pageW - (margin * 2);
    const halfW = (contentW / 2) - 4; // Gap of 8mm
    const rightX = margin + (contentW / 2) + 4;
    
    doc.setFontSize(FONT_SIZES.BODY);
    const lineHeightFactor = 1.2;
    const lineHeight = (doc.getLineHeight() / doc.internal.scaleFactor) * lineHeightFactor;
    
    // Measure labels to subtract from width if we wanted inline, but we'll do block style for safety on overflow
    // Style:
    // Label: [Value.......]
    
    doc.setFont('helvetica', 'bold');
    const leftLabelW = doc.getTextWidth(leftLabel + ': ');
    const rightLabelW = doc.getTextWidth(rightLabel + ': ');
    
    const leftTextW = halfW - leftLabelW;
    const rightTextW = halfW - rightLabelW;
    
    doc.setFont('helvetica', 'normal');
    // If value is N/A or empty, we just put a dash or empty
    const lVal = leftValue || '-';
    const rVal = rightValue || '-';
    
    const leftLines = doc.splitTextToSize(lVal, leftTextW);
    const rightLines = doc.splitTextToSize(rVal, rightTextW);
    
    const maxLines = Math.max(leftLines.length, rightLines.length);
    const blockHeight = maxLines * lineHeight;
    
    y = checkPageBreak(y, blockHeight + 2);
    
    // Left
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLORS.BLACK);
    doc.text(`${leftLabel}:`, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLORS.GRAY_DARK);
    doc.text(leftLines, margin + leftLabelW, y);
    
    // Right
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLORS.BLACK);
    doc.text(`${rightLabel}:`, rightX, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLORS.GRAY_DARK);
    doc.text(rightLines, rightX + rightLabelW, y);
    
    return y + blockHeight + 5; // Padding
};

export const exportStoryboardToPDF = async (
    storyTitle: string,
    authorName: string,
    episodes: Episode[], 
    activeEpisodeId: number | null,
    characters: Character[],
    storyboardStyle: StoryboardStyle,
    aspectRatio: string,
    t: (key: any, replacements?: { [key: string]: string | number; }) => string,
    soundtrackPrompt: string,
    logline: string,
    structuralAnalysis: string,
    treatment: string,
    references: Reference[],
    exportOptions: PDFExportOptions
): Promise<void> => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const contentW = pageW - 2 * MARGIN;

    let y = MARGIN;
    let pageCount = 1;

    const addFooter = (page: number, total: number) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(FONT_SIZES.FOOTER);
        doc.setTextColor(COLORS.GRAY_MEDIUM);
        const text = t('pdfPageInfo', { page, total });
        const textWidth = doc.getTextWidth(text);
        doc.text(text, pageW - MARGIN - textWidth, pageH - 10);
    };

    const addHeader = (title: string) => {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(FONT_SIZES.LABEL);
        doc.setTextColor(COLORS.GRAY_MEDIUM);
        doc.text(title, MARGIN, 10);
    };
    
    const checkPageBreak = (currentY: number, requiredHeight: number): number => {
        if (currentY + requiredHeight > pageH - MARGIN) {
            doc.addPage();
            pageCount++;
            addHeader(storyTitle);
            return MARGIN + 10;
        }
        return currentY;
    };

    const addNewPage = () => {
        doc.addPage();
        pageCount++;
        addHeader(storyTitle);
        return MARGIN + 10;
    };

    // --- COVER PAGE ---
    if (exportOptions.includeCover) {
        y = pageH / 3;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(FONT_SIZES.H1);
        doc.setTextColor(COLORS.BLACK);
        const titleLines = doc.splitTextToSize(storyTitle, contentW);
        doc.text(titleLines, pageW / 2, y, { align: 'center' });
        y += (titleLines.length * 12) + 10;

        const authorPlaceholder = t('authorPlaceholder');
        if (authorName && authorName.trim() && authorName.trim() !== authorPlaceholder) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(FONT_SIZES.H3);
            doc.setTextColor(COLORS.GRAY_DARK);
            doc.text(t('pdfByAuthor', { authorName }), pageW / 2, y, { align: 'center' });
            y += 20;
        }
        
        doc.setDrawColor(COLORS.GRAY_LIGHT);
        doc.line(pageW / 3, y, (pageW / 3) * 2, y);
        y += 20;

        if (logline) {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(FONT_SIZES.H3);
            const logLines = doc.splitTextToSize(logline, contentW - 40);
            doc.text(logLines, pageW / 2, y, { align: 'center' });
        }
        
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(FONT_SIZES.LABEL);
        doc.setTextColor(COLORS.GRAY_MEDIUM);
        doc.text(`${t('pdfGeneratedOn')}: ${new Date().toLocaleDateString()}`, MARGIN, pageH - MARGIN);
        
        y = addNewPage(); 
    } else {
        addHeader(storyTitle);
        y = MARGIN + 10; 
    }

    // --- METADATA & PARAMS ---
    if (exportOptions.includeMetadata) {
         doc.setFont('helvetica', 'bold');
         doc.setFontSize(FONT_SIZES.H2);
         doc.setTextColor(COLORS.BLACK);
         doc.text("Project Conditions & Parameters", MARGIN, y);
         y += 10;

         const addMetaItem = (label: string, val: string) => {
             doc.setFont('helvetica', 'bold');
             doc.setFontSize(FONT_SIZES.BODY);
             doc.text(`${label}:`, MARGIN, y);
             
             doc.setFont('helvetica', 'normal');
             const valLines = doc.splitTextToSize(val, contentW - 60);
             doc.text(valLines, MARGIN + 50, y);
             
             y += (valLines.length * 5) + 2;
             y = checkPageBreak(y, 10);
         };

         addMetaItem(t('storyboardStyleLabel'), storyboardStyle);
         addMetaItem(t('aspectRatioLabel'), aspectRatio);
         addMetaItem(t('numberOfEpisodes'), episodes.length.toString());
         addMetaItem(t('characters'), characters.length.toString());
         if (soundtrackPrompt) {
             addMetaItem(t('pdfSoundtrackPrompt'), soundtrackPrompt);
         }
         
         y += 5;
         doc.setDrawColor(COLORS.GRAY_LIGHT);
         doc.line(MARGIN, y, pageW - MARGIN, y);
         y += 10;
    }

    // --- SERIES BIBLE ---
    if (exportOptions.includeBible) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(FONT_SIZES.H2);
        doc.setTextColor(COLORS.BLACK);
        doc.text("Series Bible", MARGIN, y);
        y += 10;

        if (logline) {
            y = addLabeledBlock(doc, t('logline'), logline, y, contentW, checkPageBreak);
        }
        if (treatment) {
            y = addLabeledBlock(doc, t('treatment'), treatment, y, contentW, checkPageBreak);
        }
        if (structuralAnalysis) {
            y = addLabeledBlock(doc, t('structuralAnalysis'), structuralAnalysis, y, contentW, checkPageBreak);
        }

        y = addNewPage();
    }

    // --- CHARACTERS ---
    if (exportOptions.includeCharacters && characters.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(FONT_SIZES.H2);
        doc.setTextColor(COLORS.BLACK);
        doc.text(t('characters'), MARGIN, y);
        y += 10;

        for (const char of characters) {
            y = checkPageBreak(y, 40); 
            
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(FONT_SIZES.H3);
            doc.setTextColor(COLORS.BLACK);
            doc.text(char.name, MARGIN, y);
            y += 6;

            if (char.images && char.images.length > 0) {
                const imgW = 40;
                const portraitRatioString = getPortraitRatio(aspectRatio);
                const imgH = imgW / parseAspectRatio(portraitRatioString);
                
                y = checkPageBreak(y, imgH + 5);

                await addImageToDoc(doc, char.images[0], MARGIN, y, imgW, imgH, t);
                
                const textX = MARGIN + imgW + 5;
                const textW = contentW - imgW - 5;
                let textY = y;

                const addCharBlockInline = (label: string, val: string) => {
                    if (!val) return;
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(FONT_SIZES.LABEL);
                    doc.text(`${label}:`, textX, textY);
                    textY += 4;
                    doc.setFont('helvetica', 'normal');
                    const lines = doc.splitTextToSize(val, textW);
                    doc.text(lines, textX, textY);
                    textY += (lines.length * 4) + 2;
                };

                addCharBlockInline(t('pdfRole'), char.role);
                addCharBlockInline(t('pdfPersonality'), char.personality);
                addCharBlockInline(t('pdfAppearance'), char.appearance);
                
                y = Math.max(y + imgH + 5, textY + 5);
            } else {
                y = addLabeledBlock(doc, t('pdfRole'), char.role, y, contentW, checkPageBreak);
                y = addLabeledBlock(doc, t('pdfPersonality'), char.personality, y, contentW, checkPageBreak);
                y = addLabeledBlock(doc, t('pdfAppearance'), char.appearance, y, contentW, checkPageBreak);
            }
            
            if (exportOptions.includePrompts) {
                 const prompt = createCharacterImagePrompt(char, storyboardStyle, aspectRatio);
                 y = addLabeledBlock(doc, "AI PROMPT", prompt, y, contentW, checkPageBreak, { isPrompt: true });
            }
            
            doc.setDrawColor(COLORS.GRAY_LIGHT);
            doc.line(MARGIN, y, pageW - MARGIN, y);
            y += 8;
        }
        y = addNewPage();
    }

    // --- EPISODES ---
    const episodesToExport = exportOptions.includeAllEpisodes 
        ? episodes 
        : episodes.filter(e => e.id === activeEpisodeId);

    for (const [index, episode] of episodesToExport.entries()) {
        // Episode Header
        y = checkPageBreak(y, 30);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(FONT_SIZES.H1);
        doc.setTextColor(COLORS.BLACK);
        
        // Correct Episode Title Format: Episode X: Title
        const absoluteIndex = episodes.findIndex(e => e.id === episode.id) + 1;
        const epLabel = t('episode') || 'Episode';
        const epTitle = `${epLabel} ${absoluteIndex}: ${episode.title}`;
        const titleLines = doc.splitTextToSize(epTitle, contentW);
        
        doc.text(titleLines, MARGIN, y);
        y += (titleLines.length * 10) + 5;
        
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(FONT_SIZES.H3);
        doc.setTextColor(COLORS.GRAY_DARK);
        const synLines = doc.splitTextToSize(episode.synopsis || '', contentW);
        doc.text(synLines, MARGIN, y);
        y += (synLines.length * 6) + 10;

        // SCENES LOOP
        for (const [i, scene] of episode.scenes.entries()) {
            y = checkPageBreak(y, 30);
            
            // Scene Header
            doc.setFillColor(COLORS.GRAY_DARK);
            doc.rect(MARGIN, y, contentW, 8, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(FONT_SIZES.H3);
            doc.setTextColor(255, 255, 255);
            doc.text(`${t('scene')} ${i + 1}: ${scene.title}`, MARGIN + 2, y + 5.5);
            y += 12;

            // Scene Details (Controlled side by side)
            y = addSideBySideBlocks(
                doc, 
                t('location'), scene.location, 
                t('setting'), scene.setting, 
                y, pageW, MARGIN, checkPageBreak
            );

            if (scene.actions) {
                y = addLabeledBlock(doc, t('pdfActions'), scene.actions, y, contentW, checkPageBreak);
            }

            if (scene.notes) {
                y = addLabeledBlock(doc, t('pdfNotes'), scene.notes, y, contentW, checkPageBreak);
            }

            // --- SHOTS LAYOUT ---
            const layout = exportOptions.layout;
            
            if (layout === 'compact') {
                const gap = 5;
                const colWidth = (contentW - gap) / 2;
                const aspectRatioNum = parseAspectRatio(aspectRatio);
                const imgHeight = colWidth / aspectRatioNum;
                
                for (let j = 0; j < scene.shots.length; j++) {
                    const shot = scene.shots[j];
                    const isLeft = j % 2 === 0;
                    const xPos = isLeft ? MARGIN : MARGIN + colWidth + gap;
                    
                    // Estimate height
                    let descLines = doc.splitTextToSize(shot.description, colWidth).length;
                    let promptLines = 0;
                    if (exportOptions.includePrompts) {
                        const p = createImagePromptForShot(shot, scene, characters, storyboardStyle, aspectRatio);
                        promptLines = doc.splitTextToSize(`PROMPT: ${p}`, colWidth).length;
                    }
                    const estimatedTextHeight = 8 + (descLines * 4) + (promptLines * 3); // approximate
                    
                    if (isLeft) {
                        // Ensure we have space for at least the image and title
                         y = checkPageBreak(y, imgHeight + estimatedTextHeight + 10);
                    }

                    await addImageToDoc(doc, shot.imageUrl, xPos, y, colWidth, imgHeight, t);
                    
                    let textY = y + imgHeight + 4;
                    doc.setFontSize(FONT_SIZES.LABEL);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(COLORS.BLACK);
                    doc.text(`${t('shot')} ${j + 1} (${shot.shotType})`, xPos, textY);
                    textY += 4;

                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(COLORS.GRAY_DARK);
                    const dLines = doc.splitTextToSize(shot.description, colWidth);
                    doc.text(dLines, xPos, textY);
                    textY += (dLines.length * 3.5) + 2;

                    // Optional Prompt
                    if (exportOptions.includePrompts) {
                        const promptText = createImagePromptForShot(shot, scene, characters, storyboardStyle, aspectRatio);
                        doc.setFontSize(FONT_SIZES.TINY);
                        doc.setTextColor(COLORS.PROMPT);
                        doc.setFont('helvetica', 'italic');
                        const pLines = doc.splitTextToSize(`PROMPT: ${promptText}`, colWidth);
                        doc.text(pLines, xPos, textY);
                        // Don't advance textY massively yet
                    }
                    
                    if (!isLeft || j === scene.shots.length - 1) {
                         // Calculate row height based on max of left/right
                         const prevShot = (j > 0 && !isLeft) ? scene.shots[j-1] : null;
                         
                         const calcHeight = (s: Shot) => {
                             const lines = doc.splitTextToSize(s.description, colWidth).length;
                             let pLines = 0;
                             if (exportOptions.includePrompts) {
                                 const txt = createImagePromptForShot(s, scene, characters, storyboardStyle, aspectRatio);
                                 pLines = doc.splitTextToSize(`PROMPT: ${txt}`, colWidth).length;
                             }
                             return imgHeight + 8 + (lines * 3.5) + (pLines * 3); // approx logic matching drawing
                         };
                         
                         let leftH = prevShot ? calcHeight(prevShot) : 0;
                         let rightH = calcHeight(shot);
                         
                         // If current is left (odd total), right is 0
                         if (isLeft) { leftH = rightH; rightH = 0; }

                         y += Math.max(leftH, rightH) + 8;
                    }
                }
            } else {
                // Standard Layout
                for (const [j, shot] of scene.shots.entries()) {
                    const imgW = contentW * 0.7; 
                    const imgH = imgW / parseAspectRatio(aspectRatio);
                    const centerX = MARGIN + (contentW - imgW) / 2;

                    let requiredH = imgH + 40;
                    if (exportOptions.includePrompts) requiredH += 30; // Extra buffer for prompt
                    
                    y = checkPageBreak(y, requiredH);

                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(FONT_SIZES.BODY);
                    doc.setTextColor(COLORS.GRAY_DARK);
                    doc.text(`${t('shot')} ${j + 1}: ${shot.shotType}`, MARGIN, y);
                    y += 5;

                    await addImageToDoc(doc, shot.imageUrl, centerX, y, imgW, imgH, t);
                    y += imgH + 5;

                    y = addLabeledBlock(doc, t('description'), shot.description, y, contentW, checkPageBreak);
                    y = addLabeledBlock(doc, t('soundFx'), shot.soundFx, y, contentW, checkPageBreak);

                    if (exportOptions.includePrompts) {
                         const promptText = createImagePromptForShot(shot, scene, characters, storyboardStyle, aspectRatio);
                         y = addLabeledBlock(doc, "AI PROMPT", promptText, y, contentW, checkPageBreak, { isPrompt: true });
                    }

                    y += 5;
                    doc.setDrawColor(COLORS.GRAY_LIGHT);
                    doc.line(MARGIN, y, pageW - MARGIN, y);
                    y += 5;
                }
            }
            y += 5;
        }
        
        y = addNewPage();
    }

    const totalPages = pageCount;
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        addFooter(i, totalPages);
    }
    
    doc.save(`${storyTitle.replace(/ /g, '_')}_storyboard.pdf`);
};
