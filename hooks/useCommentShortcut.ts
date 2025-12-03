import { useState, useEffect, useCallback } from "react";
import { useCollaboration } from "../contexts/collaborationContext";
import { CommentLocation } from "../types";

export const useCommentShortcut = (
  getLocation: () => CommentLocation,
  getLocationLabel: () => string
) => {
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [locationLabel, setLocationLabel] = useState("");
  const { addComment } = useCollaboration();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Alt + K to add comment
      if (
        e.altKey &&
        (e.key === "k" || e.key === "K") &&
        !e.ctrlKey &&
        !e.shiftKey &&
        !e.metaKey
      ) {
        e.preventDefault();
        setLocationLabel(getLocationLabel());
        setShowCommentModal(true);
      }
    },
    [getLocationLabel]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleSubmitComment = (text: string) => {
    const location = getLocation();
    addComment(text, location);
    setShowCommentModal(false);
  };

  const openCommentModal = useCallback(() => {
    setLocationLabel(getLocationLabel());
    setShowCommentModal(true);
  }, [getLocationLabel]);

  return {
    showCommentModal,
    setShowCommentModal,
    locationLabel,
    handleSubmitComment,
    openCommentModal,
  };
};
