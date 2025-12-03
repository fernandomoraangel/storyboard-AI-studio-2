import React, { useState, useMemo } from "react";
import { Comment, User, Episode } from "../types";
import { useLanguage } from "../contexts/languageContext";
import { CloseIcon, MessageIcon, CheckCircleIcon, FilterIcon } from "./icons";

interface CommentsViewerProps {
  comments: Comment[];
  users: User[];
  episodes: Episode[];
  currentUserId: string;
  onNavigateToComment: (comment: Comment) => void;
  onToggleResolved: (commentId: string) => void;
  onDeleteComment: (commentId: string) => void;
  onClose: () => void;
}

export const CommentsViewer: React.FC<CommentsViewerProps> = ({
  comments,
  users,
  episodes,
  currentUserId,
  onNavigateToComment,
  onToggleResolved,
  onDeleteComment,
  onClose,
}) => {
  const { t } = useLanguage();
  const [filter, setFilter] = useState<"all" | "active" | "resolved">("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");

  const filteredComments = useMemo(() => {
    let result = [...comments];

    // Apply filter
    if (filter === "active") {
      result = result.filter((c) => !c.resolved);
    } else if (filter === "resolved") {
      result = result.filter((c) => c.resolved);
    }

    // Apply sort
    result.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return sortBy === "newest" ? timeB - timeA : timeA - timeB;
    });

    return result;
  }, [comments, filter, sortBy]);

  const getLocationLabel = (comment: Comment): string => {
    const loc = comment.location;

    if (
      loc.type === "storyboard" ||
      loc.type === "gridGallery" ||
      loc.type === "galleryView"
    ) {
      let episode, scene;

      if (loc.type === "galleryView") {
        // For galleryView, search for the scene across all episodes
        for (const ep of episodes) {
          const foundScene = ep.scenes.find((s) => s.id === loc.sceneId);
          if (foundScene) {
            episode = ep;
            scene = foundScene;
            break;
          }
        }
      } else {
        episode = episodes.find(
          (e) => "episodeId" in loc && e.id === loc.episodeId
        );
        scene = episode?.scenes.find((s) => s.id === loc.sceneId);
      }

      if (loc.type === "storyboard") {
        if (loc.shotId) {
          const shot = scene?.shots.find((sh) => sh.id === loc.shotId);
          const shotIndex =
            scene?.shots.findIndex((sh) => sh.id === loc.shotId) ?? -1;
          return `${t("storyBoardTab")} - ${episode?.title || "Episode"} - ${
            scene?.title || "Scene"
          } - Shot ${shotIndex + 1}`;
        }
        return `${t("storyBoardTab")} - ${episode?.title || "Episode"} - ${
          scene?.title || "Scene"
        }`;
      }

      if (loc.type === "gridGallery") {
        const sceneIndex =
          episode?.scenes.findIndex((s) => s.id === loc.sceneId) ?? -1;
        const shotIndex =
          scene?.shots.findIndex((sh) => sh.id === loc.shotId) ?? -1;
        return `Grid Gallery - ${sceneIndex + 1}-${shotIndex + 1}`;
      }

      if (loc.type === "galleryView") {
        const shotIndex =
          scene?.shots.findIndex((sh) => sh.id === loc.shotId) ?? -1;
        return `${t("galleryView")} - ${scene?.title || "Scene"} - Shot ${
          shotIndex + 1
        }`;
      }
    }

    if (loc.type === "narrativeArc") {
      return `${t("narrativeArcTitle")} - Point ${loc.pointId}`;
    }

    if (loc.type === "advancedArc") {
      return "Advanced Arc";
    }

    return "Unknown Location";
  };

  const getUserById = (userId: string): User | undefined => {
    return users.find((u) => u.id === userId);
  };

  const formatTimestamp = (date: Date): string => {
    const now = new Date();
    const commentDate = new Date(date);
    const diffMs = now.getTime() - commentDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t("justNow");
    if (diffMins < 60) return t("minutesAgo", { count: diffMins });
    if (diffHours < 24) return t("hoursAgo", { count: diffHours });
    if (diffDays < 7) return t("daysAgo", { count: diffDays });

    return commentDate.toLocaleDateString();
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white animate-fade-in">
      {/* Header */}
      <div className="h-16 border-b border-gray-700 flex items-center justify-between px-6 bg-gray-800/50 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <MessageIcon className="w-6 h-6 text-indigo-400" />
          <h2 className="text-xl font-bold">{t("comments")}</h2>
          <span className="text-sm text-gray-400">
            ({filteredComments.length}{" "}
            {filteredComments.length === 1 ? "comment" : "comments"})
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Filter Buttons */}
          <div className="flex bg-gray-800 rounded-lg p-1 border border-gray-700">
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filter === "all"
                  ? "bg-indigo-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {t("all")}
            </button>
            <button
              onClick={() => setFilter("active")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filter === "active"
                  ? "bg-indigo-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {t("active")}
            </button>
            <button
              onClick={() => setFilter("resolved")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filter === "resolved"
                  ? "bg-indigo-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {t("resolved")}
            </button>
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "newest" | "oldest")}
            className="bg-gray-800 border border-gray-700 rounded-md text-sm px-3 py-1.5 text-white"
          >
            <option value="newest">{t("newest")}</option>
            <option value="oldest">{t("oldest")}</option>
          </select>

          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Comments List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {filteredComments.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <MessageIcon className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg">{t("noComments")}</p>
            <p className="text-sm mt-2">{t("pressShiftCToAddComment")}</p>
          </div>
        ) : (
          filteredComments.map((comment) => {
            const user = getUserById(comment.userId);
            const isCurrentUser = comment.userId === currentUserId;

            return (
              <div
                key={comment.id}
                className={`bg-gray-800 rounded-lg p-4 border transition-all hover:shadow-lg ${
                  comment.resolved
                    ? "border-gray-700 opacity-60"
                    : "border-gray-700 hover:border-indigo-500"
                }`}
              >
                {/* User Info & Timestamp */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm"
                      style={{ backgroundColor: user?.color || "#6366f1" }}
                    >
                      {user?.name.charAt(0).toUpperCase() || "?"}
                    </div>
                    <div>
                      <div className="font-semibold text-white">
                        {user?.name || "Unknown User"}
                        {isCurrentUser && (
                          <span className="ml-2 text-xs text-indigo-400">
                            ({t("you")})
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400">
                        {formatTimestamp(comment.timestamp)}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onToggleResolved(comment.id)}
                      className={`p-1.5 rounded-full transition-colors ${
                        comment.resolved
                          ? "bg-green-600/20 text-green-400 hover:bg-green-600/30"
                          : "bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-green-400"
                      }`}
                      title={
                        comment.resolved
                          ? t("markAsUnresolved")
                          : t("markAsResolved")
                      }
                    >
                      <CheckCircleIcon className="w-4 h-4" />
                    </button>
                    {isCurrentUser && (
                      <button
                        onClick={() => onDeleteComment(comment.id)}
                        className="p-1.5 rounded-full bg-gray-700 text-gray-400 hover:bg-red-600/20 hover:text-red-400 transition-colors"
                        title={t("deleteComment")}
                      >
                        <CloseIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Comment Text */}
                <p className="text-gray-300 mb-3 whitespace-pre-wrap">
                  {comment.text}
                </p>

                {/* Context Details */}
                {(() => {
                  const loc = comment.location;
                  if (
                    loc.type === "storyboard" ||
                    loc.type === "gridGallery" ||
                    loc.type === "galleryView"
                  ) {
                    let episode, scene;

                    if (loc.type === "galleryView") {
                      // For galleryView, search for the scene across all episodes
                      for (const ep of episodes) {
                        const foundScene = ep.scenes.find(
                          (s) => s.id === loc.sceneId
                        );
                        if (foundScene) {
                          episode = ep;
                          scene = foundScene;
                          break;
                        }
                      }
                    } else {
                      episode = episodes.find(
                        (e) => "episodeId" in loc && e.id === loc.episodeId
                      );
                      scene = episode?.scenes.find((s) => s.id === loc.sceneId);
                    }

                    const shotIndex =
                      scene?.shots.findIndex((sh) => sh.id === loc.shotId) ??
                      -1;
                    const sceneIndex =
                      episode?.scenes.findIndex((s) => s.id === loc.sceneId) ??
                      -1;

                    return (
                      <div className="mb-3 p-2 bg-gray-900/50 rounded border border-gray-700 text-xs space-y-1">
                        {episode && (
                          <div className="text-gray-400">
                            <span className="text-indigo-400 font-medium">
                              {t("episode")}:
                            </span>{" "}
                            {episode.title}
                          </div>
                        )}
                        {scene && (
                          <div className="text-gray-400">
                            <span className="text-indigo-400 font-medium">
                              {t("scene")}:
                            </span>{" "}
                            {scene.title}
                          </div>
                        )}
                        {loc.shotId && shotIndex !== -1 && (
                          <div className="text-gray-400">
                            <span className="text-indigo-400 font-medium">
                              {t("shot")}:
                            </span>{" "}
                            {sceneIndex + 1}-{shotIndex + 1}
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Location Link */}
                <button
                  onClick={() => onNavigateToComment(comment)}
                  className="text-sm text-indigo-400 hover:text-indigo-300 hover:underline flex items-center gap-1"
                >
                  <span>📍</span>
                  {getLocationLabel(comment)}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
