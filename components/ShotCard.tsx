import React, { useState, useCallback, ChangeEvent } from "react";
import type {
  Shot,
  Scene,
  Character,
  StoryboardStyle,
  Comment,
  CommentLocation,
} from "../types";
import {
  generateImage,
  generateVideo,
  createImagePromptForShot,
  translateDetailsToEnglish,
} from "../services/geminiService";
import {
  SparklesIcon,
  TrashIcon,
  UploadIcon,
  ClipboardIcon,
  ChevronDownIcon,
  GripVerticalIcon,
  VideoIcon,
  MessageIcon,
  CloseIcon,
} from "./icons";
import { LoadingSpinner } from "./LoadingSpinner";
import { useLanguage } from "../contexts/languageContext";
import { useCollaboration } from "../contexts/collaborationContext";
import { CommentModal } from "./CommentModal";
import { translations, Options } from "../lib/translations";

const InputField: React.FC<{
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  name: string;
  onFieldClick?: (e: React.MouseEvent, fieldName: string) => void;
  commentsCount?: number;
  onBadgeClick?: (fieldName: string) => void;
}> = ({ label, onFieldClick, commentsCount, name, onBadgeClick, ...props }) => (
  <div>
    <div className="flex items-center gap-2 mb-1">
      <label className="block text-sm font-medium text-gray-400">{label}</label>
      {commentsCount !== undefined && commentsCount > 0 && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onBadgeClick && onBadgeClick(name);
          }}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/30 transition-colors cursor-pointer"
        >
          <MessageIcon className="w-3 h-3" />
          {commentsCount}
        </button>
      )}
    </div>
    <input
      type="text"
      name={name}
      className="block w-full rounded-md border-0 bg-white/5 py-1.5 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
      onClick={(e) => onFieldClick && onFieldClick(e, name)}
      {...props}
    />
  </div>
);

const TextAreaField: React.FC<{
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  name: string;
  rows?: number;
  placeholder?: string;
  onFieldClick?: (e: React.MouseEvent, fieldName: string) => void;
  commentsCount?: number;
  onBadgeClick?: (fieldName: string) => void;
}> = ({
  label,
  rows = 2,
  onFieldClick,
  commentsCount,
  name,
  onBadgeClick,
  ...props
}) => (
  <div>
    <div className="flex items-center gap-2 mb-1">
      <label className="block text-sm font-medium text-gray-400">{label}</label>
      {commentsCount !== undefined && commentsCount > 0 && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onBadgeClick && onBadgeClick(name);
          }}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/30 transition-colors cursor-pointer"
        >
          <MessageIcon className="w-3 h-3" />
          {commentsCount}
        </button>
      )}
    </div>
    <textarea
      name={name}
      className="block w-full rounded-md border-0 bg-white/5 py-1.5 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
      rows={rows}
      onClick={(e) => onFieldClick && onFieldClick(e, name)}
      {...props}
    />
  </div>
);

const SelectField: React.FC<{
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  name: string;
  options: readonly string[];
  unassignedLabel: string;
}> = ({ label, options, unassignedLabel, ...props }) => (
  <div>
    <label className="block text-sm font-medium text-gray-400 mb-1">
      {label}
    </label>
    <select
      className="block w-full rounded-md border-0 bg-white/5 py-1.5 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
      {...props}
    >
      <option value="">{unassignedLabel}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  </div>
);

interface ShotCardProps {
  shot: Shot;
  shotNumber: number;
  scene: Scene;
  characters: Character[];
  updateShot: (updatedShot: Shot) => void;
  deleteShot: (shotId: number) => void;
  isLastShot: boolean;
  storyboardStyle: StoryboardStyle;
  aspectRatio: string;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: (e: React.DragEvent) => void;
  episodeId?: number;
  sceneId?: number;
  comments?: Comment[];
}

export const ShotCard: React.FC<ShotCardProps> = ({
  shot,
  shotNumber,
  scene,
  characters,
  updateShot,
  deleteShot,
  isLastShot,
  storyboardStyle,
  aspectRatio,
  isDragging,
  onDragStart,
  onDragEnd,
  episodeId,
  sceneId,
  comments = [],
}) => {
  const { t, options, language } = useLanguage();
  const { addComment } = useCollaboration();
  const [isOpen, setIsOpen] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [commentField, setCommentField] = useState<string>("");
  const [commentLocation, setCommentLocation] =
    useState<CommentLocation | null>(null);
  const [showCommentsPopup, setShowCommentsPopup] = useState(false);
  const [selectedFieldComments, setSelectedFieldComments] = useState<Comment[]>(
    []
  );
  const [selectedFieldName, setSelectedFieldName] = useState<string>("");

  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [targetImageAI, setTargetImageAI] = useState("Gemini Flash Image");
  const [generatedImagePrompt, setGeneratedImagePrompt] = useState("");
  const [isImagePromptCopied, setIsImagePromptCopied] = useState(false);

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target as HTMLInputElement;
    const finalValue = type === "number" ? parseInt(value, 10) || 0 : value;
    updateShot({ ...shot, [name]: finalValue });
  };

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const imageUrl = event.target?.result as string;
        updateShot({ ...shot, imageUrl });
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleGenerateImage = useCallback(async () => {
    setIsGenerating(true);
    setGenerationError(null);
    const prompt = createImagePromptForShot(
      shot,
      scene,
      characters,
      storyboardStyle,
      aspectRatio
    );
    try {
      const imageUrl = await generateImage(prompt);
      updateShot({ ...shot, imageUrl });
    } catch (error) {
      console.error("Image generation failed:", error);
      const errorMessage =
        (error as any)?.error?.message ||
        (error as any)?.message ||
        "An unknown error occurred.";
      if (
        errorMessage.includes("quota") ||
        errorMessage.includes("RESOURCE_EXHAUSTED")
      ) {
        setGenerationError(t("quotaError"));
      } else {
        setGenerationError(t("genericGenerationError"));
      }
    } finally {
      setIsGenerating(false);
    }
  }, [shot, scene, characters, storyboardStyle, aspectRatio, updateShot, t]);

  const handleGenerateVideo = async () => {
    // Check API Key
    if (window.aistudio && !(await window.aistudio.hasSelectedApiKey())) {
      await window.aistudio.openSelectKey();
      if (!(await window.aistudio.hasSelectedApiKey())) return; // User cancelled
    }

    setIsGeneratingVideo(true);
    setGenerationError(null);

    try {
      // Prepare Image if exists
      let imageInput = null;
      if (shot.imageUrl && shot.imageUrl.startsWith("data:")) {
        const parts = shot.imageUrl.split(",");
        const mime = parts[0].match(/:(.*?);/)?.[1];
        const base64 = parts[1];
        if (mime && base64) {
          imageInput = { base64, mimeType: mime };
        }
      }

      const prompt = createImagePromptForShot(
        shot,
        scene,
        characters,
        storyboardStyle,
        aspectRatio
      );
      // Correct aspect ratio type for Veo
      const videoAspectRatio = ["9:16", "3:4"].includes(aspectRatio)
        ? "9:16"
        : "16:9";

      const videoUrl = await generateVideo(
        prompt,
        imageInput,
        videoAspectRatio,
        (key) => {
          /* optional progress feedback */
        }
      );

      updateShot({ ...shot, videoUrl });
    } catch (e) {
      console.error(e);
      const errorMessage = (e as Error).message || "Unknown error";
      if (errorMessage.includes("Requested entity was not found.")) {
        setGenerationError(t("errorApiKey"));
      } else {
        setGenerationError(t("errorGeneric", { message: errorMessage }));
      }
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  const getCharacterDetailsForPrompt = useCallback((): string => {
    if (
      !scene.characters ||
      scene.characters.toLowerCase() === "none" ||
      characters.length === 0
    ) {
      return "";
    }
    const sceneCharacterNames = scene.characters
      .split(",")
      .map((name) => name.trim().toLowerCase());
    const includedCharacters = characters.filter((char) =>
      sceneCharacterNames.includes(char.name.toLowerCase())
    );

    if (includedCharacters.length === 0)
      return `Characters: ${scene.characters}.`;

    return (
      "Characters involved: " +
      includedCharacters
        .map((char) => {
          return `${char.name} (${char.appearance}, wearing ${char.outfit}, personality: ${char.personality})`;
        })
        .join(". ") +
      "."
    );
  }, [scene.characters, characters]);

  const clean = (str: string) => str?.trim() || "";
  const formatPrompt = (prompt: string) =>
    prompt
      .replace(/, ,/g, ",")
      .replace(/, \./g, ".")
      .replace(/  +/g, " ")
      .replace(/, \s*--/g, " --")
      .trim();

  const getEnglishPromptDetails = useCallback(async (): Promise<any> => {
    const characterDetailsString = getCharacterDetailsForPrompt();

    if (language === "en") {
      return {
        ...shot,
        setting: scene.setting,
        characterDetails: characterDetailsString,
      };
    }

    const textFieldsToTranslate = {
      description: shot.description,
      setting: scene.setting,
      atmosphere: shot.atmosphere,
      characterDetails: characterDetailsString,
    };

    const translatedTextFields = await translateDetailsToEnglish(
      textFieldsToTranslate
    );

    const findEnglishOption = (
      spanishValue: string,
      optionKey: keyof Options
    ): string => {
      if (!spanishValue) return "";
      const spanishOptions = translations.es.options[optionKey];
      const englishOptions = translations.en.options[optionKey];

      if (Array.isArray(spanishOptions) && Array.isArray(englishOptions)) {
        const index = spanishOptions.indexOf(spanishValue);
        return index !== -1 ? englishOptions[index] : spanishValue;
      }
      return spanishValue;
    };

    return {
      description: translatedTextFields.description,
      setting: translatedTextFields.setting,
      atmosphere: translatedTextFields.atmosphere,
      characterDetails: translatedTextFields.characterDetails,
      shotType: findEnglishOption(shot.shotType, "shotTypeOptions"),
      cameraMovement: findEnglishOption(
        shot.cameraMovement,
        "cameraMovementOptions"
      ),
      cameraType: findEnglishOption(shot.cameraType, "cameraTypeOptions"),
      lensType: findEnglishOption(shot.lensType, "lensTypeOptions"),
      lensBlur: findEnglishOption(shot.lensBlur, "lensBlurOptions"),
      lighting: findEnglishOption(shot.lighting, "lightingOptions"),
      style: findEnglishOption(shot.style, "styleOptions"),
      colorGrade: findEnglishOption(shot.colorGrade, "colorGradeOptions"),
      filmStock: findEnglishOption(shot.filmStock, "filmStockOptions"),
      filmGrain: findEnglishOption(shot.filmGrain, "filmGrainOptions"),
    };
  }, [language, scene, shot, getCharacterDetailsForPrompt]);

  const generateImagePromptText = async () => {
    setIsGeneratingPrompt(true);
    try {
      const englishDetails = await getEnglishPromptDetails();

      let prompt = "";
      const action = clean(englishDetails.description);
      const setting = clean(englishDetails.setting);
      const shotType = clean(englishDetails.shotType);
      const move = clean(englishDetails.cameraMovement);
      const cam = clean(englishDetails.cameraType);
      const lens = clean(englishDetails.lensType);
      const lensBlur = clean(englishDetails.lensBlur);
      const atmos = clean(englishDetails.atmosphere);
      const light = clean(englishDetails.lighting);
      const style = clean(englishDetails.style);
      const colorGrade = clean(englishDetails.colorGrade);
      const filmStock = clean(englishDetails.filmStock);
      const characterDetails = englishDetails.characterDetails || "";

      switch (targetImageAI) {
        case "Gemini Flash Image":
          prompt = `High-quality cinematic image of: ${action}. The setting is ${setting}. ${characterDetails} The visual style is ${style}, with ${atmos} atmosphere, and ${light} lighting. Shot type: ${shotType}, camera movement: ${move}. 16:9 aspect ratio.`;
          break;
        case "Midjourney":
          prompt = `${action}, ${setting}, ${characterDetails} ${shotType}, ${move} shot with ${cam} and ${lens} lens, ${lensBlur} bokeh, atmosphere of ${atmos}, ${light} lighting, in the style of ${style}, color graded with ${colorGrade}, simulating ${filmStock} film --ar 16:9 --style raw`;
          break;
        case "Meta AI":
          prompt = `photograph, ${action} in ${setting}. ${characterDetails} Mood: ${atmos}. Style: ${style}, ${light}.`;
          break;
        default: // Generic
          prompt = `cinematic shot, ${action}, setting is ${setting}. ${characterDetails} Shot type: ${shotType}, ${move} camera movement with a ${cam} and a ${lens} lens. Lens blur/bokeh: ${lensBlur}. Atmosphere: ${atmos}. Lighting: ${light}. Style: ${style}. Color Grading: ${colorGrade}. Film Stock: ${filmStock}.`;
          break;
      }
      setGeneratedImagePrompt(formatPrompt(prompt));
    } catch (error) {
      console.error("Error generating prompt:", error);
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  const copyImagePrompt = () => {
    navigator.clipboard.writeText(generatedImagePrompt);
    setIsImagePromptCopied(true);
    setTimeout(() => setIsImagePromptCopied(false), 2000);
  };

  const handleFieldClick = (e: React.MouseEvent, fieldName: string) => {
    if (e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      const location: CommentLocation = {
        type: "storyboard",
        episodeId: episodeId || 0,
        sceneId: sceneId || 0,
        shotId: shot.id,
        fieldName: fieldName,
      };
      setCommentLocation(location);
      setCommentField(fieldName);
      setShowCommentModal(true);
    }
  };

  const handleImageClick = (e: React.MouseEvent) => {
    if (e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      const location: CommentLocation = {
        type: "storyboard",
        episodeId: episodeId || 0,
        sceneId: sceneId || 0,
        shotId: shot.id,
        fieldName: "image",
      };
      setCommentLocation(location);
      setCommentField("image");
      setShowCommentModal(true);
    }
  };

  const handleSubmitComment = (text: string) => {
    if (commentLocation) {
      addComment(text, commentLocation);
      setShowCommentModal(false);
    }
  };

  const getCommentsCount = (fieldName: string) => {
    return comments.filter((c) => {
      const loc = c.location;
      if (loc.type !== "storyboard") return false;
      if (loc.sceneId !== sceneId) return false;
      if (loc.shotId !== shot.id) return false;
      if (loc.fieldName !== fieldName) return false;
      return !c.resolved;
    }).length;
  };

  const handleShowFieldComments = (fieldName: string) => {
    const fieldComments = comments.filter((c) => {
      const loc = c.location;
      if (loc.type !== "storyboard") return false;
      if (loc.sceneId !== sceneId) return false;
      if (loc.shotId !== shot.id) return false;
      if (loc.fieldName !== fieldName) return false;
      return !c.resolved;
    });
    setSelectedFieldComments(fieldComments);
    setSelectedFieldName(fieldName);
    setShowCommentsPopup(true);
  };

  return (
    <div
      className={`bg-gray-900/40 rounded-lg border border-gray-700 ${
        isDragging ? "dragging-item" : ""
      }`}
      onDragOver={(e) => e.preventDefault()}
    >
      <div
        className="flex justify-between items-center p-4"
        aria-expanded={isOpen}
        aria-controls={`shot-content-${shot.id}`}
      >
        <div
          draggable
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          className="p-2 drag-handle text-gray-500 hover:text-white"
          title={t("dragToReorder")}
        >
          <GripVerticalIcon className="w-5 h-5" />
        </div>
        <div
          className="flex items-center gap-4 flex-1 cursor-pointer"
          onClick={() => setIsOpen(!isOpen)}
        >
          <h4 className="text-md font-bold text-indigo-300">
            {t("shot")} {shotNumber}
          </h4>
          <div className="flex items-center gap-2">
            <label
              htmlFor={`duration-${shot.id}`}
              className="text-xs font-medium text-gray-400"
            >
              {t("duration")}
            </label>
            <input
              id={`duration-${shot.id}`}
              type="number"
              name="duration"
              value={shot.duration}
              onChange={handleChange}
              onClick={(e) => e.stopPropagation()}
              className="w-16 text-center rounded-md border-0 bg-white/5 py-1 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm"
              aria-label="Shot duration in seconds"
            />
            <span className="text-xs text-gray-400">{t("secondsAbbr")}</span>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {!isLastShot && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteShot(shot.id);
              }}
              className="text-red-500 hover:text-red-400 transition-colors"
              aria-label={`Delete shot ${shotNumber}`}
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          )}
          <button onClick={() => setIsOpen(!isOpen)} className="p-1">
            <ChevronDownIcon
              className={`w-5 h-5 text-gray-400 transform transition-transform duration-200 ${
                isOpen ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>
      </div>

      <div
        id={`shot-content-${shot.id}`}
        className={`transition-all duration-500 ease-in-out overflow-hidden ${
          isOpen ? "max-h-[3000px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-4 pb-4 space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="block text-sm font-medium text-gray-400">
                {t("image")}
              </label>
              {getCommentsCount("image") > 0 && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleShowFieldComments("image");
                  }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/30 transition-colors cursor-pointer"
                >
                  <MessageIcon className="w-3 h-3" />
                  {getCommentsCount("image")}
                </button>
              )}
            </div>
            <div
              className="aspect-video w-full bg-gray-700 rounded-md flex items-center justify-center overflow-hidden relative group cursor-pointer"
              onClick={handleImageClick}
            >
              {isGenerating || isGeneratingVideo ? (
                <div className="text-center">
                  <LoadingSpinner />
                  <p className="text-sm mt-2">
                    {isGeneratingVideo
                      ? t("generatingVideo")
                      : t("generatingImage")}
                  </p>
                </div>
              ) : shot.videoUrl ? (
                <div className="w-full h-full relative">
                  <video
                    src={shot.videoUrl}
                    controls
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => updateShot({ ...shot, videoUrl: null })}
                    className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white p-1 rounded z-10 text-xs"
                  >
                    Close Video
                  </button>
                </div>
              ) : shot.imageUrl ? (
                <img
                  src={shot.imageUrl}
                  alt={`${t("shot")} ${shotNumber}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-gray-500">{t("noImage")}</span>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <label className="flex-1 cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-transparent hover:bg-gray-700 text-blue-400 hover:text-blue-300 h-10 px-4 py-2">
              <UploadIcon className="w-4 h-4 mr-2" />
              {t("upload")}
              <input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleImageUpload}
              />
            </label>
            <button
              onClick={handleGenerateImage}
              disabled={isGenerating || isGeneratingVideo}
              className="flex-1 inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-indigo-600 text-indigo-50 hover:bg-indigo-600/90 h-10 px-4 py-2 disabled:bg-indigo-400"
            >
              <SparklesIcon className="w-4 h-4 mr-2" />
              {isGenerating ? t("generating") : t("generate")}
            </button>
            <button
              onClick={handleGenerateVideo}
              disabled={isGenerating || isGeneratingVideo}
              className="flex-1 inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-purple-600 text-purple-50 hover:bg-purple-600/90 h-10 px-4 py-2 disabled:bg-purple-400"
            >
              <VideoIcon className="w-4 h-4 mr-2" />
              {isGeneratingVideo ? "..." : t("generateVideo")}
            </button>
          </div>
          {generationError && (
            <div className="mt-2 text-sm text-red-400 bg-red-900/50 p-3 rounded-md text-center">
              {generationError}
            </div>
          )}

          <TextAreaField
            label={t("description")}
            name="description"
            value={shot.description}
            onChange={handleChange}
            rows={4}
            onFieldClick={handleFieldClick}
            commentsCount={getCommentsCount("description")}
            onBadgeClick={handleShowFieldComments}
          />
          <InputField
            label={t("soundFx")}
            name="soundFx"
            value={shot.soundFx}
            onChange={handleChange}
            onFieldClick={handleFieldClick}
            commentsCount={getCommentsCount("soundFx")}
            onBadgeClick={handleShowFieldComments}
          />

          <div className="border-t border-gray-700 pt-4">
            <h4 className="text-base font-semibold text-gray-300 mb-4">
              {t("technicalDetails")}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SelectField
                label={t("shotType")}
                name="shotType"
                value={shot.shotType}
                onChange={handleChange}
                options={options.shotTypeOptions}
                unassignedLabel={t("unassigned")}
              />
              <SelectField
                label={t("cameraMovement")}
                name="cameraMovement"
                value={shot.cameraMovement}
                onChange={handleChange}
                options={options.cameraMovementOptions}
                unassignedLabel={t("unassigned")}
              />
              <SelectField
                label={t("cameraType")}
                name="cameraType"
                value={shot.cameraType}
                onChange={handleChange}
                options={options.cameraTypeOptions}
                unassignedLabel={t("unassigned")}
              />
              <SelectField
                label={t("lensType")}
                name="lensType"
                value={shot.lensType}
                onChange={handleChange}
                options={options.lensTypeOptions}
                unassignedLabel={t("unassigned")}
              />
              <SelectField
                label={t("lensBlur")}
                name="lensBlur"
                value={shot.lensBlur}
                onChange={handleChange}
                options={options.lensBlurOptions}
                unassignedLabel={t("unassigned")}
              />
              <SelectField
                label={t("lightingScheme")}
                name="lighting"
                value={shot.lighting}
                onChange={handleChange}
                options={options.lightingOptions}
                unassignedLabel={t("unassigned")}
              />
              <SelectField
                label={t("style")}
                name="style"
                value={shot.style}
                onChange={handleChange}
                options={options.styleOptions}
                unassignedLabel={t("unassigned")}
              />
              <SelectField
                label={t("colorGrade")}
                name="colorGrade"
                value={shot.colorGrade}
                onChange={handleChange}
                options={options.colorGradeOptions}
                unassignedLabel={t("unassigned")}
              />
              <SelectField
                label={t("filmStock")}
                name="filmStock"
                value={shot.filmStock}
                onChange={handleChange}
                options={options.filmStockOptions}
                unassignedLabel={t("unassigned")}
              />
              <SelectField
                label={t("filmGrain")}
                name="filmGrain"
                value={shot.filmGrain}
                onChange={handleChange}
                options={options.filmGrainOptions}
                unassignedLabel={t("unassigned")}
              />
              <div className="sm:col-span-2">
                <InputField
                  label={t("atmosphere")}
                  name="atmosphere"
                  value={shot.atmosphere}
                  onChange={handleChange}
                  onFieldClick={handleFieldClick}
                  commentsCount={getCommentsCount("atmosphere")}
                  onBadgeClick={handleShowFieldComments}
                />
              </div>
              <div className="sm:col-span-2">
                <TextAreaField
                  label={t("otherNotes")}
                  name="technicalNotes"
                  value={shot.technicalNotes}
                  onChange={handleChange}
                  rows={2}
                  onFieldClick={handleFieldClick}
                  commentsCount={getCommentsCount("technicalNotes")}
                  onBadgeClick={handleShowFieldComments}
                />
              </div>
              <div className="sm:col-span-2">
                <TextAreaField
                  label={t("shotNotes")}
                  name="notes"
                  value={shot.notes}
                  onChange={handleChange}
                  rows={2}
                  placeholder={t("shotNotesPlaceholder") as string}
                  onFieldClick={handleFieldClick}
                  commentsCount={getCommentsCount("notes")}
                  onBadgeClick={handleShowFieldComments}
                />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-700 pt-4">
            <h4 className="text-base font-semibold text-gray-300 mb-4">
              {t("promptGenerators")}
            </h4>
            <div className="space-y-3">
              <h5 className="font-semibold text-gray-400">{t("forImage")}</h5>
              <div className="grid grid-cols-2 gap-2 items-end">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">
                    {t("targetAI")}
                  </label>
                  <select
                    value={targetImageAI}
                    onChange={(e) => setTargetImageAI(e.target.value)}
                    className="block w-full rounded-md border-0 bg-white/5 py-1.5 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
                  >
                    <option value="Gemini Flash Image">
                      Gemini Flash Image
                    </option>
                    <option value="Midjourney">Midjourney</option>
                    <option value="Meta AI">Meta AI</option>
                    <option value="Generic">{t("generic")}</option>
                  </select>
                </div>
                <button
                  onClick={generateImagePromptText}
                  disabled={isGeneratingPrompt}
                  className="w-full h-9 inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-transparent hover:bg-gray-700 disabled:opacity-50"
                >
                  {isGeneratingPrompt ? (
                    <LoadingSpinner />
                  ) : (
                    t("generatePrompt")
                  )}
                </button>
              </div>
              {generatedImagePrompt && (
                <div className="relative">
                  <textarea
                    readOnly
                    value={generatedImagePrompt}
                    className="block w-full rounded-md border-0 bg-white/5 py-1.5 text-gray-300 shadow-sm ring-1 ring-inset ring-white/10 sm:text-sm"
                    rows={4}
                  />
                  <button
                    onClick={copyImagePrompt}
                    className="absolute top-2 right-2 p-1.5 rounded-md bg-gray-900/50 hover:bg-gray-700 text-blue-400 hover:text-blue-300"
                  >
                    <ClipboardIcon className="w-4 h-4" />
                  </button>
                  {isImagePromptCopied && (
                    <span className="absolute top-2 right-10 text-xs text-indigo-400 bg-gray-900 px-2 py-1 rounded">
                      {t("copied")}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Comments Popup */}
      {showCommentsPopup && (
        <div
          className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
          onClick={() => setShowCommentsPopup(false)}
        >
          <div
            className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full border border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <MessageIcon className="w-5 h-5 text-indigo-400" />
                {t("comments")} - {selectedFieldName}
              </h3>
              <button
                onClick={() => setShowCommentsPopup(false)}
                className="text-gray-400 hover:text-white"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 max-h-96 overflow-y-auto space-y-3">
              {selectedFieldComments.length === 0 ? (
                <p className="text-gray-400 text-center py-4">
                  {t("noComments")}
                </p>
              ) : (
                selectedFieldComments.map((comment) => {
                  const loc = comment.location;
                  let locationText = "";
                  if (loc.type === "storyboard") {
                    locationText = `${t("shot")} ${shotNumber}`;
                    if (loc.fieldName) locationText += ` - ${loc.fieldName}`;
                  }
                  return (
                    <div
                      key={comment.id}
                      className="bg-gray-700/50 rounded p-3 border border-gray-600"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                          style={{ backgroundColor: "#6366f1" }}
                        >
                          {comment.userId?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-white">
                            User {comment.userId}
                          </p>
                          <p className="text-xs text-gray-400">
                            {locationText}
                          </p>
                        </div>
                      </div>
                      <p className="text-white text-sm mb-2">{comment.text}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(comment.timestamp).toLocaleString()}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Comment Modal */}
      {showCommentModal && commentLocation && (
        <CommentModal
          onSubmit={handleSubmitComment}
          onClose={() => setShowCommentModal(false)}
          locationLabel={`${t("shot")} ${shotNumber} - ${commentField}`}
          sceneTitle={scene.title}
          shotNumber={`${shotNumber}`}
        />
      )}
    </div>
  );
};
