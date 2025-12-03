import React, { createContext, useContext } from "react";
import { CommentLocation } from "../types";

interface CollaborationContextType {
  addComment: (text: string, location: CommentLocation) => void;
  currentUserId: string;
}

export const CollaborationContext = createContext<
  CollaborationContextType | undefined
>(undefined);

export const useCollaboration = () => {
  const context = useContext(CollaborationContext);
  if (!context) {
    throw new Error(
      "useCollaboration must be used within CollaborationContext.Provider"
    );
  }
  return context;
};
