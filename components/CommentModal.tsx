import React, { useState } from "react";
import { useLanguage } from "../contexts/languageContext";
import { CloseIcon, MessageIcon } from "./icons";

interface CommentModalProps {
  onSubmit: (text: string) => void;
  onClose: () => void;
  locationLabel: string;
  episodeTitle?: string;
  sceneTitle?: string;
  shotNumber?: string;
}

export const CommentModal: React.FC<CommentModalProps> = ({
  onSubmit,
  onClose,
  locationLabel,
  episodeTitle,
  sceneTitle,
  shotNumber,
}) => {
  const { t } = useLanguage();
  const [text, setText] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      onSubmit(text.trim());
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <MessageIcon className="w-5 h-5 text-indigo-400" />
            <h3 className="text-lg font-bold text-white">{t("addComment")}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white transition-colors"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Location */}
        <div className="px-4 pt-3 pb-2 space-y-2">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span>📍</span>
            <span>{locationLabel}</span>
          </div>
          {(episodeTitle || sceneTitle || shotNumber) && (
            <div className="pl-6 space-y-1 text-xs">
              {episodeTitle && (
                <div className="text-gray-400">
                  <span className="text-indigo-400 font-medium">
                    {t("episode")}:
                  </span>{" "}
                  {episodeTitle}
                </div>
              )}
              {sceneTitle && (
                <div className="text-gray-400">
                  <span className="text-indigo-400 font-medium">
                    {t("scene")}:
                  </span>{" "}
                  {sceneTitle}
                </div>
              )}
              {shotNumber && (
                <div className="text-gray-400">
                  <span className="text-indigo-400 font-medium">
                    {t("shot")}:
                  </span>{" "}
                  {shotNumber}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("commentPrompt")}
            rows={4}
            autoFocus
            className="w-full bg-gray-700/50 border border-gray-600 rounded-lg p-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
          />

          {/* Actions */}
          <div className="flex gap-3 justify-end mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md text-sm font-medium transition-colors"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={!text.trim()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t("submit")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
