
import type { Scene, Shot } from '../types';

export interface AnimaticOptions {
    width: number;
    t: (key: string, replacements?: { [key: string]: string | number }) => string;
    includeSceneTitles: boolean;
    includeShotDescriptions: boolean;
    fontSize: number; // As a percentage of canvas height
    fontColor: string;
    backgroundColor: string;
    textBackgroundColor: string;
}

const FPS = 25;
const TRANSITION_DURATION_MS = 500;
const FONT_FAMILY = 'sans-serif';

const parseAspectRatio = (ratioStr: string): number => {
    const parts = ratioStr.split(':');
    if (parts.length === 2) {
        const [w, h] = parts.map(parseFloat);
        return h > 0 ? w / h : 16 / 9;
    }
    return 16 / 9;
};

const loadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
        img.src = url;
    });
};

const renderFrame = (
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement | null,
    scene: Scene,
    shot: Shot,
    sceneNumber: number,
    shotNumber: number,
    options: AnimaticOptions
) => {
    const { canvas } = ctx;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Background
    ctx.fillStyle = options.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (img) {
        // Draw image letterboxed/pillarboxed
        const canvasAspect = canvas.width / canvas.height;
        const imgAspect = img.width / img.height;
        let drawW = canvas.width;
        let drawH = canvas.height;
        let drawX = 0;
        let drawY = 0;

        if (imgAspect > canvasAspect) { // Image is wider
            drawH = canvas.width / imgAspect;
            drawY = (canvas.height - drawH) / 2;
        } else { // Image is taller or same aspect
            drawW = canvas.height * imgAspect;
            drawX = (canvas.width - drawW) / 2;
        }
        ctx.drawImage(img, drawX, drawY, drawW, drawH);
    } else {
        // Render placeholder text for missing image
        ctx.fillStyle = '#333';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#666';
        ctx.font = `italic ${canvas.height * 0.05}px ${FONT_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText("Image not available", canvas.width / 2, canvas.height / 2);
    }
    
    // Text Overlay
    if (options.includeSceneTitles || options.includeShotDescriptions) {
        const textMargin = canvas.width * 0.02;
        const sceneText = `${options.t('scene')} ${sceneNumber}: ${scene.title}`;
        const shotText = `${options.t('shot')} ${shotNumber}: ${shot.description}`;
        const textHeight = canvas.height * (options.fontSize / 100);

        ctx.font = `bold ${textHeight}px ${FONT_FAMILY}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        
        const lines: string[] = [];
        if (options.includeSceneTitles) lines.push(sceneText);
        if (options.includeShotDescriptions) lines.push(shotText);

        const textMetrics = lines.map(line => ctx.measureText(line));
        const maxWidth = textMetrics.length > 0 ? Math.max(...textMetrics.map(m => m.width)) : 0;
        const totalTextHeight = lines.length * textHeight * 1.2;
        
        if (lines.length > 0) {
            // Text background
            ctx.fillStyle = options.textBackgroundColor;
            ctx.fillRect(textMargin - 5, canvas.height - textMargin - totalTextHeight - 5, maxWidth + 10, totalTextHeight + 10);
        }
        
        // Text
        ctx.fillStyle = options.fontColor;
        let currentY = canvas.height - textMargin - 5; // Adjust for padding
        
        // Draw from bottom up
        if (options.includeShotDescriptions) {
             ctx.fillText(shotText, textMargin, currentY);
             currentY -= textHeight * 1.2;
        }
        if (options.includeSceneTitles) {
            ctx.fillText(sceneText, textMargin, currentY);
        }
    }
};


export const generateAnimatic = (
    scenes: Scene[],
    aspectRatioStr: string,
    options: AnimaticOptions
): Promise<Blob> => {
    return new Promise(async (resolve, reject) => {
        const aspectRatio = parseAspectRatio(aspectRatioStr);
        const canvas = document.createElement('canvas');
        canvas.width = options.width;
        canvas.height = options.width / aspectRatio;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            return reject(new Error("Could not get canvas context"));
        }
        
        const allShots = scenes.flatMap((scene, sceneIndex) => 
            scene.shots.map((shot, shotIndex) => ({
                shot,
                scene,
                sceneNumber: sceneIndex + 1,
                shotNumber: shotIndex + 1,
            }))
        ); // Include ALL shots, regardless of image presence

        if (allShots.length === 0) {
            return reject(new Error("No shots to generate animatic."));
        }

        const stream = canvas.captureStream(FPS);
        const recorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' });
        const recordedChunks: Blob[] = [];

        recorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };

        recorder.onstop = () => {
            const blob = new Blob(recordedChunks, { type: 'video/webm' });
            resolve(blob);
        };
        
        recorder.onerror = (event) => {
            reject((event as any).error || new Error("MediaRecorder error"));
        }

        recorder.start();
        
        try {
            for (let i = 0; i < allShots.length; i++) {
                const current = allShots[i];
                const next = allShots[i + 1];

                // Load image if available, else null
                const img = current.shot.imageUrl ? await loadImage(current.shot.imageUrl) : null;

                // Hold shot
                const holdDuration = Math.max(1, current.shot.duration) * 1000 - (next ? TRANSITION_DURATION_MS / 2 : 0);
                const holdFrames = Math.max(1, Math.round(holdDuration / 1000 * FPS));
                
                for (let j = 0; j < holdFrames; j++) {
                    renderFrame(ctx, img, current.scene, current.shot, current.sceneNumber, current.shotNumber, options);
                    await new Promise(r => setTimeout(r, 1000 / FPS));
                }

                // Transition
                if (next) {
                    const nextImg = next.shot.imageUrl ? await loadImage(next.shot.imageUrl) : null;
                    const transitionFrames = Math.round(TRANSITION_DURATION_MS / 1000 * FPS);

                    for (let j = 0; j < transitionFrames; j++) {
                        const progress = j / transitionFrames;
                        
                        // Draw outgoing shot fading out
                        ctx.globalAlpha = 1 - progress;
                        renderFrame(ctx, img, current.scene, current.shot, current.sceneNumber, current.shotNumber, options);
                        
                        // Draw incoming shot fading in
                        ctx.globalAlpha = progress;
                        renderFrame(ctx, nextImg, next.scene, next.shot, next.sceneNumber, next.shotNumber, options);
                        
                        ctx.globalAlpha = 1; // Reset alpha
                        await new Promise(r => setTimeout(r, 1000 / FPS));
                    }
                }
            }
        } catch(e) {
             if (recorder.state === "recording") {
                recorder.stop();
            }
            reject(e);
            return;
        }

        // Add final hold for the last shot
        const lastShotInfo = allShots[allShots.length-1];
        const lastImg = lastShotInfo.shot.imageUrl ? await loadImage(lastShotInfo.shot.imageUrl) : null;
        const finalHoldFrames = Math.round((TRANSITION_DURATION_MS / 2) / 1000 * FPS);
        for (let j = 0; j < finalHoldFrames; j++) {
             renderFrame(ctx, lastImg, lastShotInfo.scene, lastShotInfo.shot, lastShotInfo.sceneNumber, lastShotInfo.shotNumber, options);
             await new Promise(r => setTimeout(r, 1000 / FPS));
        }

        if (recorder.state === "recording") {
            recorder.stop();
        }
    });
};
