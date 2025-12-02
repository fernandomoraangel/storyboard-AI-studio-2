import React, { useState } from "react";
import { useLanguage } from "../contexts/languageContext";
import {
  LayoutGridIcon,
  FilmIcon,
  UserIcon,
  BookOpenIcon,
  VideoIcon,
  ChartBarIcon,
  ActivityIcon,
  FolderOpenIcon,
  UsersIcon,
  CameraIcon,
  GalleryIcon,
  HomeIcon,
  WandIcon,
  CheckCircleIcon,
} from "./icons";

interface HomeProps {
  setWorkflowPhase: (phase: string) => void;
  onOpenModificationModal?: () => void;
  onOpenConsistencyModal?: () => void;
}

export const Home: React.FC<HomeProps> = ({
  setWorkflowPhase,
  onOpenModificationModal,
  onOpenConsistencyModal,
}) => {
  const { t } = useLanguage();
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const flowNodes = [
    {
      id: "setup",
      label: "Setup",
      nodes: [
        {
          id: "creativeTeam",
          icon: CameraIcon,
          labelKey: "creativeTeam",
          descKey: "creativeTeamDesc",
        },
        {
          id: "authors",
          icon: UsersIcon,
          labelKey: "authorsTitle",
          descKey: "authorsDesc",
        },
      ],
    },
    {
      id: "ideation",
      label: "Ideation",
      nodes: [
        {
          id: "generator",
          icon: LayoutGridIcon,
          labelKey: "storyGeneratorTab",
          descKey: "storyGeneratorDesc",
        },
      ],
    },
    {
      id: "structure",
      label: "Structure",
      nodes: [
        {
          id: "arc",
          icon: ActivityIcon,
          labelKey: "narrativeArcTitle",
          descKey: "narrativeArcDesc",
        },
        {
          id: "advanced_arc",
          icon: ActivityIcon,
          labelKey: "advancedArcTitle",
          descKey: "advancedArcDesc",
        },
        {
          id: "bible",
          icon: BookOpenIcon,
          labelKey: "outlineTab",
          descKey: "seriesBibleDesc",
        },
      ],
    },
    {
      id: "refinement",
      label: "Refinement",
      nodes: [
        {
          id: "episodes",
          icon: FolderOpenIcon,
          labelKey: "episodes",
          descKey: "episodesDesc",
        },
        {
          id: "organizer",
          icon: LayoutGridIcon,
          labelKey: "visualOrganizerTitle",
          descKey: "visualOrganizerDesc",
        },
      ],
    },
    {
      id: "cocreate",
      label: "Co-Create",
      nodes: [
        {
          id: "modify",
          icon: WandIcon,
          labelKey: "modifyStory",
          descKey: "modifyStoryDesc",
        },
        {
          id: "consistency",
          icon: CheckCircleIcon,
          labelKey: "checkConsistency",
          descKey: "checkConsistencyDesc",
        },
      ],
    },
    {
      id: "visualization",
      label: "Visualization",
      nodes: [
        {
          id: "storyboard",
          icon: FilmIcon,
          labelKey: "storyBoardTab",
          descKey: "storyboardDesc",
        },
        {
          id: "grid_gallery",
          icon: LayoutGridIcon,
          labelKey: "gridGalleryTitle",
          descKey: "gridGalleryDesc",
        },
        {
          id: "gallery",
          icon: GalleryIcon,
          labelKey: "galleryView",
          descKey: "galleryViewDesc",
        },
      ],
    },
    {
      id: "production",
      label: "Production",
      nodes: [
        {
          id: "video",
          icon: VideoIcon,
          labelKey: "videoGeneratorTab",
          descKey: "videoGeneratorDesc",
        },
      ],
    },
    {
      id: "tools",
      label: "Tools",
      nodes: [
        {
          id: "utilities",
          icon: ChartBarIcon,
          labelKey: "utilitiesTitle",
          descKey: "utilitiesDesc",
        },
      ],
    },
  ];

  return (
    <div className="p-8 h-full flex flex-col items-center justify-center overflow-y-auto">
      <h1 className="text-3xl font-bold text-white mb-8 bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">
        {t("welcomeTitle") || "Welcome to Storyboard AI Studio"}
      </h1>

      <div className="relative w-full max-w-5xl">
        {/* Connecting Line */}
        <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-700 -z-10 transform -translate-y-1/2 hidden md:block" />

        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
          {flowNodes.map((group, index) => (
            <div
              key={group.id}
              className="flex flex-col items-center gap-4 relative group"
            >
              {/* Group Label */}
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 hidden md:block">
                {t(group.label.toLowerCase() as any) || group.label}
              </div>

              {/* Nodes in Group */}
              <div className="flex flex-col gap-3 w-full">
                {group.nodes.map((node) => (
                  <div
                    key={node.id}
                    className="relative"
                    onMouseEnter={() => setHoveredNode(node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                  >
                    <button
                      onClick={() => {
                        if (node.id === "modify" && onOpenModificationModal) {
                          onOpenModificationModal();
                        } else if (
                          node.id === "consistency" &&
                          onOpenConsistencyModal
                        ) {
                          onOpenConsistencyModal();
                        } else {
                          setWorkflowPhase(node.id);
                        }
                      }}
                      className="w-full p-4 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 hover:border-indigo-500 transition-all shadow-lg flex flex-col items-center gap-2 z-10 relative"
                    >
                      <node.icon className="w-8 h-8 text-indigo-400" />
                      <span className="text-xs font-medium text-center text-gray-300">
                        {t(node.labelKey as any)}
                      </span>
                    </button>

                    {/* Popup / Tooltip */}
                    {hoveredNode === node.id && (
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-3 w-64 bg-gray-900 border border-indigo-500/50 rounded-lg p-3 shadow-2xl z-50 animate-fade-in">
                        <div className="text-sm font-bold text-white mb-1">
                          {t(node.labelKey as any)}
                        </div>
                        <div className="text-xs text-gray-400 leading-relaxed">
                          {t(node.descKey as any) ||
                            "Description not available."}
                        </div>
                        {/* Arrow */}
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-8 border-transparent border-t-gray-900" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
