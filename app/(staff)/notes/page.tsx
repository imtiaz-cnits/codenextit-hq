"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "../../../integrations/supabase/client";
import { useAuth } from "../../../lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "../../../components/ui/dialog";
import { Checkbox } from "../../../components/ui/checkbox";
import { ScrollArea } from "../../../components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "../../../components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from "../../../components/ui/dropdown-menu";
import {
  FileText, Globe, Calendar, AlertTriangle, AlertCircle, ShieldCheck, Edit, Trash2, Plus,
  ExternalLink, Loader2, RefreshCw, Search, Folder, FolderOpen, DollarSign, Bell, ArrowLeft, ChevronLeft, ChevronDown, Save,
  Share2, Users, Bold, Italic, Underline, List, ListOrdered, AlignLeft, AlignCenter,
  AlignRight, Heading1, Heading2, Heading3, Palette, Eraser, Check, Cloud, CloudOff, Lock,
  ChevronRight, HardDrive, Type, FolderPlus, Paintbrush, Table2, Baseline, MoreVertical, SlidersHorizontal,
  Mic, AudioLines, Maximize2, ListTodo, Undo2, Redo2, Printer, Link, MessageSquarePlus, Image, AlignJustify, Outdent, Indent, Minus, ArrowUpDown, Highlighter, X,
  Star, Pin
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "../../../lib/format";
import { CardGridSkeleton } from "../../../components/loading-skeletons";
import { cn } from "../../../lib/utils";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "../../../components/ui/carousel";
import * as Y from "yjs";
import { SupabaseYjsProvider, getSelectionCharacterOffsetWithin, setSelectionCharacterOffsetWithin } from "./collaboration";
import { Avatar, AvatarFallback, AvatarImage } from "../../../components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../../components/ui/tooltip";

import { useSpeechToText } from "../../../hooks/use-speech-to-text";
import { useAudioRecorder } from "../../../hooks/use-audio-recorder";

interface Profile {
  id: string;
  full_name: string;
}

interface SharedStaffMember {
  staff_id: string;
  full_name: string;
  permission_level: "view" | "edit";
}

interface NoteRow {
  id: string;
  title: string;
  content: string;
  client_id: string | null;
  client_name: string | null;
  folder_id: string | null;
  created_by: string;
  creator_name: string;
  created_at: string;
  updated_at: string;
  permission_level: "view" | "edit";
  shared_with: SharedStaffMember[];
  audio_url: string | null;
  is_pinned?: boolean;
  is_favorite?: boolean;
}

interface ClientRow {
  id: string;
  company_name: string;
  permission_level?: "view" | "edit";
}

interface NoteFolder {
  id: string;
  name: string;
  parent_id?: string | null;
  client_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  shared_with?: SharedStaffMember[];
  is_pinned?: boolean;
  is_favorite?: boolean;
}

interface TreeNode {
  folder: NoteFolder;
  children: TreeNode[];
}

const SUPPORTED_FONTS = [
  "Inter", "Roboto", "Outfit", "Poppins", "Montserrat", "Open Sans",
  "Lato", "Josefin Sans", "Ubuntu", "Nunito", "Oswald",
  "Playfair Display", "Lora", "Merriweather", "Cinzel",
  "Fira Code", "Source Code Pro", "Pacifico", "Dancing Script",
  "Hind Siliguri", "Baloo Da 2", "Anek Bangla", "Noto Sans Bengali", "Noto Serif Bengali",
  "Google Sans Flex", "Roboto Mono", "Calibri", "Sora"
];

const POPULAR_GOOGLE_FONTS = [
  "Montserrat", "Poppins", "Playfair Display", "Lora", "Fira Code",
  "Dancing Script", "Pacifico", "Lobster", "Caveat", "Teko",
  "Kanit", "Cinzel", "Great Vibes", "Righteous", "Comfortaa",
  "Sacramento", "Fredoka One", "Abel", "Acme", "Alata",
  "Amatic SC", "Bangers", "Bebas Neue", "Cabin", "Cardo",
  "Cookie", "Creepster", "Crimson Text", "Domine", "Gloria Hallelujah",
  "Josefin Sans", "Jost", "Kaushan Script", "Libre Baskerville", "Lobster Two",
  "Merriweather", "Noto Sans", "Nunito", "Orbitron", "Oswald",
  "PT Sans", "PT Serif", "Patua One", "Permanent Marker", "Play",
  "Quicksand", "Rajdhani", "Russo One", "Shadows Into Light", "Signika",
  "Special Elite", "Spirax", "Tangerine", "Ubuntu", "Varela Round", "Yellowtail"
];

const ADDITIONAL_POPULAR_FONTS = POPULAR_GOOGLE_FONTS.filter(f => !SUPPORTED_FONTS.includes(f));


const SUPPORTED_COLORS = [
  "#2563eb", "#dc2626", "#16a34a", "#eab308", "#7c3aed"
];

const SUPPORTED_HIGHLIGHT_COLORS = [
  "#fef08a", "#bbf7d0", "#bfdbfe", "#fbcfe8", "#fed7aa", "#fca5a5"
];

const COLOR_PALETTE = [
  "#000000", "#434343", "#666666", "#999999", "#b7b7b7", "#cccccc", "#d9d9d9", "#efefef", "#f3f3f3", "#ffffff",
  "#980000", "#ff0000", "#ff9900", "#ffff00", "#00ff00", "#00ffff", "#4a86e8", "#0000ff", "#9900ff", "#ff00ff",
  "#e6b8af", "#f4ccd6", "#fce5cd", "#fff2cc", "#d9ead3", "#d0e0e3", "#c9daf8", "#cfe2f3", "#d9d2e9", "#ead1dc",
  "#dd7e6b", "#ea9999", "#f9cb9c", "#ffe599", "#b6d7a8", "#a2c4c9", "#a4c2f4", "#9fc5e8", "#b4a7d6", "#d5a6bd",
  "#cc4125", "#e06666", "#f6b26b", "#ffd966", "#93c47d", "#76a5af", "#6d9ee1", "#6fa8dc", "#8e7cc3", "#c27ba0",
  "#a61c00", "#cc0000", "#e69138", "#f1c232", "#6aa84f", "#45818e", "#3c78d8", "#3d85c6", "#674ea7", "#a64d79",
  "#851000", "#990000", "#b45f06", "#bf9000", "#38761d", "#134f5c", "#1155cc", "#0b5394", "#351c75", "#741b47",
  "#5b0f00", "#660000", "#783f04", "#7f6000", "#274e13", "#0c343d", "#1c4587", "#073763", "#20124d", "#4c1130"
];

const rgbToHex = (rgbStr: string | undefined | null) => {
  if (!rgbStr) return "#000000";
  const matches = rgbStr.match(/\d+/g);
  if (matches && matches.length >= 3) {
    const r = parseInt(matches[0], 10);
    const g = parseInt(matches[1], 10);
    const b = parseInt(matches[2], 10);
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toLowerCase();
  }
  return "#000000";
};

const injectGoogleFont = (fontName: string) => {
  if (typeof window === "undefined" || !fontName) return;
  const id = `google-font-${fontName.toLowerCase().replace(/\s+/g, '-')}`;
  if (document.getElementById(id)) return;

  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/\s+/g, '+')}:wght@400;500;700&display=swap`;
  document.head.appendChild(link);
};

const loadFontsFromHtml = (html: string, onLoadFont?: (font: string) => void) => {
  if (typeof window === "undefined" || !html) return;
  const regex = /font-family:\s*(?:&quot;|["'])([^;&"']+)(?:&quot;|["'])|font-family:\s*([^;"]+)/gi;
  let match;
  const fonts = new Set<string>();
  while ((match = regex.exec(html)) !== null) {
    const fontName = (match[1] || match[2] || "").trim();
    if (fontName && !["inherit", "sans-serif", "serif", "monospace"].includes(fontName.toLowerCase())) {
      fonts.add(fontName);
    }
  }
  fonts.forEach(font => {
    const standardFonts = ["Arial", "Courier New", "Georgia", "Times New Roman", "Trebuchet MS", "Verdana", "Calibri", "Inter"];
    if (!standardFonts.includes(font)) {
      injectGoogleFont(font);
      if (onLoadFont) {
        onLoadFont(font);
      }
    }
  });
};

const sanitizeHtml = (html: string): string => {
  if (typeof window === "undefined") return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  const allowedTags = new Set([
    "b", "strong", "i", "em", "u", "a", "p",
    "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6", "br"
  ]);

  const blockTags = new Set([
    "p", "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6"
  ]);

  function processNode(node: Node): Node[] {
    if (node.nodeType === Node.TEXT_NODE) {
      return [document.createTextNode(node.textContent || "")];
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return [];
    }

    const el = node as HTMLElement;
    const tagName = el.tagName.toLowerCase();

    const cleanChildren: Node[] = [];
    for (let i = 0; i < el.childNodes.length; i++) {
      cleanChildren.push(...processNode(el.childNodes[i]));
    }

    if (allowedTags.has(tagName)) {
      const cleanEl = document.createElement(tagName);

      if (tagName === "a" && el.hasAttribute("href")) {
        const href = el.getAttribute("href") || "";
        if (!href.toLowerCase().startsWith("javascript:")) {
          cleanEl.setAttribute("href", href);
          cleanEl.setAttribute("target", "_blank");
          cleanEl.setAttribute("rel", "noopener noreferrer");
        }
      }

      cleanChildren.forEach(child => cleanEl.appendChild(child));
      return [cleanEl];
    } else {
      const isLayoutBlock = [
        "div", "section", "article", "header", "footer",
        "table", "tbody", "tr", "td", "th", "aside", "blockquote"
      ].includes(tagName);

      if (isLayoutBlock) {
        const resultNodes: Node[] = [];
        let inlineBuffer: Node[] = [];

        const flushBuffer = () => {
          if (inlineBuffer.length > 0) {
            const hasContent = inlineBuffer.some(n => {
              if (n.nodeType === Node.TEXT_NODE) {
                return (n.textContent || "").trim().length > 0;
              }
              return n.nodeName.toLowerCase() !== "br";
            });

            if (hasContent) {
              const p = document.createElement("p");
              inlineBuffer.forEach(n => p.appendChild(n));
              resultNodes.push(p);
            }
            inlineBuffer = [];
          }
        };

        cleanChildren.forEach(child => {
          const childTagName = child.nodeType === Node.ELEMENT_NODE ? (child as HTMLElement).tagName.toLowerCase() : "";
          const isChildBlock = blockTags.has(childTagName);

          if (isChildBlock) {
            flushBuffer();
            resultNodes.push(child);
          } else {
            inlineBuffer.push(child);
          }
        });

        flushBuffer();
        return resultNodes;
      } else {
        return cleanChildren;
      }
    }
  }

  const cleanBody = document.createElement("body");
  for (let i = 0; i < doc.body.childNodes.length; i++) {
    processNode(doc.body.childNodes[i]).forEach(node => cleanBody.appendChild(node));
  }

  return cleanBody.innerHTML;
};

const getSelectedBlockElements = (editor: HTMLElement, range: Range): HTMLElement[] => {
  const blocks: HTMLElement[] = [];

  if (range.collapsed) {
    let node: Node | null = range.startContainer;
    let element = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement;
    while (element && element !== editor) {
      if (["P", "DIV", "H1", "H2", "H3", "LI", "TD"].includes(element.tagName.toUpperCase())) {
        blocks.push(element);
        break;
      }
      element = element.parentElement;
    }
    return blocks;
  }

  const walker = document.createTreeWalker(
    editor,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: (node) => {
        const el = node as HTMLElement;
        if (["P", "DIV", "H1", "H2", "H3", "LI", "TD"].includes(el.tagName.toUpperCase())) {
          try {
            const nodeRange = document.createRange();
            nodeRange.selectNode(el);
            const intersects = range.compareBoundaryPoints(Range.END_TO_START, nodeRange) < 0 &&
              range.compareBoundaryPoints(Range.START_TO_END, nodeRange) > 0;
            if (intersects) {
              return NodeFilter.FILTER_ACCEPT;
            }
          } catch (e) { }
        }
        return NodeFilter.FILTER_SKIP;
      }
    }
  );

  let current = walker.nextNode() as HTMLElement | null;
  while (current) {
    blocks.push(current);
    current = walker.nextNode() as HTMLElement | null;
  }

  if (blocks.length === 0) {
    let startNode: Node | null = range.startContainer;
    let startEl = startNode.nodeType === Node.ELEMENT_NODE ? (startNode as HTMLElement) : startNode.parentElement;
    while (startEl && startEl !== editor) {
      if (["P", "DIV", "H1", "H2", "H3", "LI", "TD"].includes(startEl.tagName.toUpperCase())) {
        blocks.push(startEl);
        break;
      }
      startEl = startEl.parentElement;
    }
  }

  return blocks;
};


export default function NotesPage() {
  const { profile, roles } = useAuth();
  const isAdmin = roles.includes("super_admin") || roles.includes("admin");

  const { isListening, transcript, startListening, stopListening, setTranscript, isTranscribing } = useSpeechToText();
  const { isRecording, audioBlob, startRecording, stopRecording, uploadAudio, setAudioBlob } = useAudioRecorder();

  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]); // Vault client folders representing clients list
  const [folders, setFolders] = useState<NoteFolder[]>([]); // Custom client-wise folders created in Notes module
  const [activeStaff, setActiveStaff] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  // Folder navigation: null = main view, string = custom NoteFolder UUID
  const [activeFolderId, setActiveFolderId] = useState<null | string>(null);

  // Search/Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [clientFilter, setClientFilter] = useState<"all" | "internal" | string>("all");
  const [scopeFilter, setScopeFilter] = useState<"all" | "mine" | "shared">("all");
  const [isFoldersExpanded, setIsFoldersExpanded] = useState(false);
  const [visibleNotesCount, setVisibleNotesCount] = useState(21);
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Create document modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createClientId, setCreateClientId] = useState<string>("");
  const [createFolderId, setCreateFolderId] = useState<string>("");
  const [creating, setCreating] = useState(false);

  // Create custom notes folder state
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderClientId, setNewFolderClientId] = useState<string>("none");
  const [newFolderParentId, setNewFolderParentId] = useState<string>("none");
  const [creatingFolder, setCreatingFolder] = useState(false);

  // Rename custom notes folder state
  const [renameFolderOpen, setRenameFolderOpen] = useState(false);
  const [renameFolderId, setRenameFolderId] = useState("");
  const [renameFolderName, setRenameFolderName] = useState("");
  const [renamingFolder, setRenamingFolder] = useState(false);

  // Move item modal state
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveItemId, setMoveItemId] = useState("");
  const [moveItemType, setMoveItemType] = useState<"note" | "folder">("note");
  const [moveTargetFolderId, setMoveTargetFolderId] = useState<string>("none");
  const [movingItem, setMovingItem] = useState(false);

  // Editor state
  const [currentNote, setCurrentNote] = useState<NoteRow | null>(null);
  const [openNotes, setOpenNotes] = useState<NoteRow[]>([]);
  const [editorTitle, setEditorTitle] = useState("");
  const [editorClientId, setEditorClientId] = useState<string>("");
  const [editorFolderId, setEditorFolderId] = useState<string>("");
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const lastTranscriptRef = useRef("");

  // When transcription finishes, append the transcript
  useEffect(() => {
    if (transcript && editorRef.current) {
      // Focus editor and insert at current selection if possible, otherwise append
      editorRef.current.focus();
      restoreSelection();

      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);

        if (!isListening && !isTranscribing) {
          // Final transcript
          const textNode = document.createTextNode(transcript + " ");
          range.deleteContents();
          range.insertNode(textNode);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
          lastTranscriptRef.current = "";
        } else {
          // Interim or transcribing transcript
          let interimSpan = editorRef.current.querySelector("#interim-transcript");
          if (!interimSpan) {
            interimSpan = document.createElement("span");
            interimSpan.id = "interim-transcript";
            range.insertNode(interimSpan);
          }
          if (isTranscribing) {
            interimSpan.className = "text-primary/70 italic animate-pulse";
            interimSpan.textContent = transcript + " (Correcting...)";
          } else {
            interimSpan.className = "text-muted-foreground italic";
            interimSpan.textContent = transcript;
          }

          range.setStartAfter(interimSpan);
          range.setEndAfter(interimSpan);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      } else {
        if (!isListening && !isTranscribing) {
          const textNode = document.createTextNode(transcript + " ");
          editorRef.current.appendChild(textNode);
        }
      }

      handleEditorInput();
      if (!isListening && !isTranscribing) setTranscript("");
      saveSelection();
    } else if (transcript.startsWith("Error:")) {
      // Clear error after showing it
      setTimeout(() => {
        if (transcript.startsWith("Error:")) {
          setTranscript("");
        }
      }, 5000);
    }
  }, [transcript, isListening, isTranscribing]);

  // Clean up interim span on stop
  useEffect(() => {
    if (editorRef.current) {
      const interimSpan = editorRef.current.querySelector("#interim-transcript");
      if (interimSpan) {
        if (transcript.startsWith("Error:")) {
          interimSpan.remove();
          handleEditorInput();
        } else if (!isListening && !isTranscribing) {
          const text = transcript || interimSpan.textContent?.replace(" (Correcting...)", "") || "";
          if (text.trim() === "") {
            interimSpan.remove();
          } else {
            const textNode = document.createTextNode(text + " ");
            interimSpan.parentNode?.replaceChild(textNode, interimSpan);
          }
          handleEditorInput();
        }
      }
    }
  }, [isListening, isTranscribing, transcript]);

  // Handle Recording stop and upload
  useEffect(() => {
    const handleAudioUpload = async () => {
      if (!isRecording && audioBlob && currentNote) {
        setIsUploadingAudio(true);
        try {
          const publicUrl = await uploadAudio(currentNote.id, audioBlob);
          if (publicUrl) {
            insertAudioBlock(publicUrl);
            setAudioBlob(null);
          }
        } catch (err) {
          console.error("Failed to upload and insert audio:", err);
          toast.error("Failed to upload audio");
        } finally {
          setIsUploadingAudio(false);
        }
      }
    };
    handleAudioUpload();
  }, [isRecording, audioBlob]);

  // Delegated event listener for custom audio players
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const handlePlayClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      const playBtn = target.closest(".voice-note-play-btn");
      const slider = target.closest(".voice-note-slider-container");
      const deleteBtn = target.closest(".voice-note-delete-btn");

      if (deleteBtn) {
        e.preventDefault();
        e.stopPropagation();
        if (confirm("Are you sure you want to delete this voice note?")) {
          const container = deleteBtn.closest(".voice-note-container");
          if (container) {
            container.remove();
            handleEditorInput();
          }
        }
        return;
      }

      if (playBtn) {
        e.preventDefault();
        e.stopPropagation();
        const container = playBtn.closest(".voice-note-container");
        const audio = container?.querySelector(".voice-note-audio") as HTMLAudioElement;
        const playIcon = playBtn.querySelector(".play-icon");
        const pauseIcon = playBtn.querySelector(".pause-icon");

        if (audio && playIcon && pauseIcon) {
          if (audio.paused) {
            // Pause all other playing voice notes
            editor.querySelectorAll(".voice-note-audio").forEach((otherAudioAny) => {
              const otherAudio = otherAudioAny as HTMLAudioElement;
              if (otherAudio !== audio && !otherAudio.paused) {
                otherAudio.pause();
                const otherContainer = otherAudio.closest(".voice-note-container");
                const otherPlayBtn = otherContainer?.querySelector(".voice-note-play-btn");
                const otherPlayIcon = otherPlayBtn?.querySelector(".play-icon");
                const otherPauseIcon = otherPlayBtn?.querySelector(".pause-icon");
                if (otherPlayIcon && otherPauseIcon) {
                  otherPlayIcon.classList.remove("hidden");
                  otherPauseIcon.classList.add("hidden");
                }
              }
            });

            audio.play().catch(err => console.error(err));
            playIcon.classList.add("hidden");
            pauseIcon.classList.remove("hidden");
          } else {
            audio.pause();
            playIcon.classList.remove("hidden");
            pauseIcon.classList.add("hidden");
          }
        }
      }

      if (slider) {
        e.preventDefault();
        e.stopPropagation();
        const container = slider.closest(".voice-note-container");
        const audio = container?.querySelector(".voice-note-audio") as HTMLAudioElement;
        if (audio && audio.duration) {
          const rect = slider.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const percentage = Math.max(0, Math.min(1, clickX / rect.width));
          audio.currentTime = percentage * audio.duration;
        }
      }
    };

    const handleTimeUpdate = (e: Event) => {
      const audio = e.target as HTMLAudioElement;
      if (!audio.classList.contains("voice-note-audio")) return;

      const container = audio.closest(".voice-note-container");
      if (!container) return;

      const progress = container.querySelector(".voice-note-progress") as HTMLElement;
      const timeDisplay = container.querySelector(".voice-note-time") as HTMLElement;

      if (progress && timeDisplay) {
        const currentTime = audio.currentTime || 0;
        const duration = audio.duration || 0;

        const formatTime = (time: number) => {
          if (isNaN(time)) return "0:00";
          const mins = Math.floor(time / 60);
          const secs = Math.floor(time % 60);
          return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
        };

        const percent = duration > 0 ? (currentTime / duration) * 100 : 0;
        progress.style.width = `${percent}%`;
        timeDisplay.innerText = `${formatTime(currentTime)} / ${formatTime(duration)}`;
      }
    };

    const handleAudioEnded = (e: Event) => {
      const audio = e.target as HTMLAudioElement;
      if (!audio.classList.contains("voice-note-audio")) return;

      const container = audio.closest(".voice-note-container");
      const playBtn = container?.querySelector(".voice-note-play-btn");
      const playIcon = playBtn?.querySelector(".play-icon");
      const pauseIcon = playBtn?.querySelector(".pause-icon");

      if (playIcon && pauseIcon) {
        playIcon.classList.remove("hidden");
        pauseIcon.classList.add("hidden");
      }
    };

    const handleMetadataLoad = (e: Event) => {
      const audio = e.target as HTMLAudioElement;
      if (!audio.classList.contains("voice-note-audio")) return;

      const container = audio.closest(".voice-note-container");
      const timeDisplay = container?.querySelector(".voice-note-time") as HTMLElement;
      if (timeDisplay) {
        const formatTime = (time: number) => {
          if (isNaN(time)) return "0:00";
          const mins = Math.floor(time / 60);
          const secs = Math.floor(time % 60);
          return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
        };
        timeDisplay.innerText = `0:00 / ${formatTime(audio.duration)}`;
      }
    };

    // Initialize durations for already loaded elements
    editor.querySelectorAll(".voice-note-audio").forEach((audioAny) => {
      const audio = audioAny as HTMLAudioElement;
      if (audio.duration) {
        const container = audio.closest(".voice-note-container");
        const timeDisplay = container?.querySelector(".voice-note-time") as HTMLElement;
        if (timeDisplay) {
          const formatTime = (time: number) => {
            if (isNaN(time)) return "0:00";
            const mins = Math.floor(time / 60);
            const secs = Math.floor(time % 60);
            return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
          };
          timeDisplay.innerText = `0:00 / ${formatTime(audio.duration)}`;
        }
      }
    });

    editor.addEventListener("click", handlePlayClick);
    editor.addEventListener("timeupdate", handleTimeUpdate, true);
    editor.addEventListener("ended", handleAudioEnded, true);
    editor.addEventListener("loadedmetadata", handleMetadataLoad, true);

    return () => {
      editor.removeEventListener("click", handlePlayClick);
      editor.removeEventListener("timeupdate", handleTimeUpdate, true);
      editor.removeEventListener("ended", handleAudioEnded, true);
      editor.removeEventListener("loadedmetadata", handleMetadataLoad, true);
    };
  }, [currentNote]);

  const insertAudioBlock = (url: string) => {
    if (!editorRef.current) return;

    editorRef.current.focus();
    restoreSelection();

    const container = document.createElement("div");
    container.className = "voice-note-container my-4 p-4 bg-muted/60 dark:bg-muted/30 rounded-2xl border border-border/80 flex items-center gap-4 not-prose select-none";
    container.contentEditable = "false";

    const audio = document.createElement("audio");
    audio.src = url;
    audio.className = "voice-note-audio hidden";

    const playBtn = document.createElement("button");
    playBtn.className = "voice-note-play-btn flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0";
    playBtn.innerHTML = `
      <svg class="play-icon w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
      <svg class="pause-icon w-4 h-4 fill-current hidden" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
    `;

    const playerBody = document.createElement("div");
    playerBody.className = "flex-1 flex flex-col gap-1.5 min-w-0";

    const metaInfo = document.createElement("div");
    metaInfo.className = "flex items-center justify-between text-[11px] font-semibold text-muted-foreground/90";

    const label = document.createElement("span");
    label.className = "tracking-wider uppercase text-[10px] font-bold text-primary/80";
    label.innerText = "Voice Note Attachment";

    const timeDisplay = document.createElement("span");
    timeDisplay.className = "voice-note-time tabular-nums";
    timeDisplay.innerText = "0:00 / 0:00";

    metaInfo.appendChild(label);
    metaInfo.appendChild(timeDisplay);

    const sliderContainer = document.createElement("div");
    sliderContainer.className = "voice-note-slider-container relative w-full h-1.5 bg-secondary/80 rounded-full cursor-pointer overflow-hidden";

    const progressBar = document.createElement("div");
    progressBar.className = "voice-note-progress absolute top-0 left-0 h-full w-0 bg-primary rounded-full transition-all duration-100";

    sliderContainer.appendChild(progressBar);

    playerBody.appendChild(metaInfo);
    playerBody.appendChild(sliderContainer);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "voice-note-delete-btn flex items-center justify-center p-2 rounded-xl text-muted-foreground/75 hover:text-destructive hover:bg-destructive/10 transition-all cursor-pointer shrink-0";
    deleteBtn.title = "Delete Voice Note";
    deleteBtn.innerHTML = `
      <svg class="w-4 h-4 fill-none stroke-current" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
        <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"/>
      </svg>
    `;

    container.appendChild(audio);
    container.appendChild(playBtn);
    container.appendChild(playerBody);
    container.appendChild(deleteBtn);

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(container);

      // Add a line break after the audio block for easier typing
      const br = document.createElement("p");
      br.innerHTML = "<br>";
      container.after(br);

      range.setStartAfter(br);
      range.setEndAfter(br);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      editorRef.current.appendChild(container);
      const br = document.createElement("p");
      br.innerHTML = "<br>";
      editorRef.current.appendChild(br);
    }

    handleEditorInput();
    saveSelection();
  };

  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const [selectedFont, setSelectedFont] = useState("Inter");
  const [selectedFontSize, setSelectedFontSize] = useState("16");
  const [selectedColor, setSelectedColor] = useState("#000000");
  const [zoom, setZoom] = useState("100%");
  const [selectedBlockFormat, setSelectedBlockFormat] = useState("p");
  const [selectedHighlightColor, setSelectedHighlightColor] = useState("transparent");
  const [customColors, setCustomColors] = useState<string[]>([]);
  const [recentFonts, setRecentFonts] = useState<string[]>(["Hind Siliguri", "Inter", "Outfit"]);
  const [selectedLineSpacing, setSelectedLineSpacing] = useState("1.15");
  const [selectedAlignment, setSelectedAlignment] = useState<"left" | "center" | "right" | "justify">("left");
  const [hasSpaceBefore, setHasSpaceBefore] = useState(false);
  const [hasSpaceAfter, setHasSpaceAfter] = useState(false);
  const [isCustomSpacingOpen, setIsCustomSpacingOpen] = useState(false);
  const [customSpacingValue, setCustomSpacingValue] = useState("1.15");
  const [customSpaceBefore, setCustomSpaceBefore] = useState("0");
  const [customSpaceAfter, setCustomSpaceAfter] = useState("0");
  const [isTextColorOpen, setIsTextColorOpen] = useState(false);
  const [isHighlightColorOpen, setIsHighlightColorOpen] = useState(false);
  const hasSeededRef = useRef(false);
  const isInitialSyncDoneRef = useRef(false);
  const [isMoreFontsOpen, setIsMoreFontsOpen] = useState(false);
  const [dynamicallyLoadedFonts, setDynamicallyLoadedFonts] = useState<string[]>([]);
  const [fontSearchQuery, setFontSearchQuery] = useState("");
  const savedSelectionRef = useRef<Range | null>(null);
  const [isFormatPainterActive, setIsFormatPainterActive] = useState(false);
  const allAvailableFonts = useMemo(() => {
    return [...new Set([...SUPPORTED_FONTS, ...dynamicallyLoadedFonts])].sort();
  }, [dynamicallyLoadedFonts]);
  const copiedStylesRef = useRef<{
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    fontName?: string;
    foreColor?: string;
    highlightColor?: string;
    fontSizeAttr?: string;
  }>({});
  const [isInsideTable, setIsInsideTable] = useState(false);
  const [hoveredRow, setHoveredRow] = useState(0);
  const [hoveredCol, setHoveredCol] = useState(0);
  const [tableInsertOpen, setTableInsertOpen] = useState(false);
  const [insertMenuOpen, setInsertMenuOpen] = useState(false);
  const [hoveredRowMobile, setHoveredRowMobile] = useState(0);
  const [hoveredColMobile, setHoveredColMobile] = useState(0);
  const [tableInsertOpenMobile, setTableInsertOpenMobile] = useState(false);
  const [isFormatPanelOpen, setIsFormatPanelOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [activeFormatTab, setActiveFormatTab] = useState<"text" | "paragraph">("text");
  const activeCellRef = useRef<HTMLTableCellElement | null>(null);

  const saveSelection = () => {
    if (typeof window === "undefined") return;
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedSelectionRef.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const restoreSelection = () => {
    if (typeof window === "undefined" || !savedSelectionRef.current) return;
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(savedSelectionRef.current);
    }
  };

  const editorRef = useRef<HTMLDivElement>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [floatingMenuCoords, setFloatingMenuCoords] = useState<{ top: number; left: number; height: number } | null>(null);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const isPopoverOpenRef = useRef(false);
  const activeBlockRef = useRef<HTMLElement | null>(null);
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const hydratedRootsRef = useRef<Map<Element, any>>(new Map());
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Collaborative states and refs
  const [activeUsers, setActiveUsers] = useState<any[]>([]);
  const activeUsersRef = useRef<any[]>([]);
  const [remoteCursors, setRemoteCursors] = useState<any[]>([]);
  const ydocRef = useRef<Y.Doc | null>(null);
  const yproviderRef = useRef<SupabaseYjsProvider | null>(null);
  const isSyncingRef = useRef(false);
  const isAudioActionActive = isListening || isTranscribing || isRecording || isUploadingAudio;

  const getHashColor = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 80%, 42%)`;
  };

  // Close lightbox on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLightboxUrl(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // 1. Image upload method to Supabase note_assets
  const uploadImageFile = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const path = `${fileName}`;

      const { data, error } = await supabase.storage
        .from("note_assets")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from("note_assets")
        .getPublicUrl(path);

      return publicUrl;
    } catch (err: any) {
      console.error("Image upload failed:", err);
      toast.error(`Image upload failed: ${err.message || err}`);
      return null;
    }
  };

  // 2. Hydrate all Carousel Sliders
  const hydrateSliders = (container: HTMLElement) => {
    // Unmount any existing roots first to avoid memory leaks
    hydratedRootsRef.current.forEach((root) => {
      try { root.unmount(); } catch (e) { console.error(e); }
    });
    hydratedRootsRef.current.clear();

    const sliderElements = container.querySelectorAll(".image-slider-block");
    sliderElements.forEach((el) => {
      const urlsStr = el.getAttribute("data-urls");
      if (!urlsStr) return;

      try {
        const urls = JSON.parse(urlsStr);
        if (!Array.isArray(urls)) return;

        import("react-dom/client").then(({ createRoot }) => {
          const root = createRoot(el);
          root.render(
            <SliderBlock
              urls={urls}
              onViewImage={setLightboxUrl}
              onDelete={() => {
                el.remove();
                handleEditorInput();
              }}
            />
          );
          hydratedRootsRef.current.set(el, root);
        });
      } catch (err) {
        console.error("Failed to parse slider urls:", err);
      }
    });
  };

  // 3. Auto-merge logic
  const checkAndMergeImages = (container: HTMLElement) => {
    const children = Array.from(container.children);
    let consecutiveImages: HTMLElement[] = [];

    const triggerMerge = (images: HTMLElement[]) => {
      if (images.length < 2) return;

      const urls = images.map((imgContainer) => {
        const img = imgContainer.querySelector("img");
        return img ? img.src : "";
      }).filter(Boolean);

      const sliderEl = document.createElement("div");
      sliderEl.className = "image-slider-block relative my-4 w-full max-w-[600px] mx-auto";
      sliderEl.setAttribute("contenteditable", "false");
      sliderEl.setAttribute("data-urls", JSON.stringify(urls));

      const firstImg = images[0];
      firstImg.parentNode?.replaceChild(sliderEl, firstImg);

      for (let i = 1; i < images.length; i++) {
        images[i].remove();
      }

      import("react-dom/client").then(({ createRoot }) => {
        const root = createRoot(sliderEl);
        root.render(
          <SliderBlock
            urls={urls}
            onViewImage={setLightboxUrl}
            onDelete={() => {
              sliderEl.remove();
              handleEditorInput();
            }}
          />
        );
        hydratedRootsRef.current.set(sliderEl, root);
      });

      handleEditorInput();
    };

    for (let i = 0; i < children.length; i++) {
      const child = children[i] as HTMLElement;
      if (child.classList.contains("editor-image-container")) {
        consecutiveImages.push(child);
      } else {
        if (consecutiveImages.length >= 2) {
          triggerMerge(consecutiveImages);
        }
        consecutiveImages = [];
      }
    }

    if (consecutiveImages.length >= 2) {
      triggerMerge(consecutiveImages);
    }
  };

  // 4. Insert image block helper
  const insertImageBlock = (url: string) => {
    if (!editorRef.current) return;

    editorRef.current.focus();
    restoreSelection();

    const container = document.createElement("div");
    container.className = "editor-image-container relative inline-block my-2 group select-none cursor-pointer border border-transparent rounded-lg";
    container.setAttribute("contenteditable", "false");
    container.style.width = "350px";

    const img = document.createElement("img");
    img.src = url;
    img.className = "w-full h-auto rounded-lg select-none";

    const handle = document.createElement("div");
    handle.className = "image-resize-handle absolute bottom-1 right-1 w-3 h-3 bg-primary rounded-full border border-background cursor-se-resize opacity-0 group-hover:opacity-100 transition-opacity";

    const viewBtn = document.createElement("button");
    viewBtn.className = "image-view-btn absolute top-2 right-2 flex items-center justify-center w-7 h-7 bg-black/60 hover:bg-black/80 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all border border-white/10 shadow-sm cursor-pointer z-10 animate-in fade-in duration-200";
    viewBtn.innerHTML = `<svg class="w-3.5 h-3.5 fill-none stroke-current" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>`;
    viewBtn.title = "View Full Screen";

    container.appendChild(img);
    container.appendChild(handle);
    container.appendChild(viewBtn);

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);

      let parentBlock: HTMLElement | null = null;
      let node = range.startContainer;
      let currentElement = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement;

      while (currentElement && currentElement !== editorRef.current) {
        if (currentElement.parentElement === editorRef.current) {
          parentBlock = currentElement;
          break;
        }
        currentElement = currentElement.parentElement;
      }

      if (parentBlock) {
        const text = parentBlock.textContent?.trim() || "";
        const isEmpty = text === "" && (parentBlock.innerHTML === "" || parentBlock.innerHTML === "<br>");
        if (isEmpty) {
          parentBlock.parentNode?.replaceChild(container, parentBlock);
        } else {
          parentBlock.after(container);
        }
      } else {
        range.deleteContents();
        range.insertNode(container);
      }

      const br = document.createElement("p");
      br.innerHTML = "<br>";
      container.after(br);

      range.setStartAfter(br);
      range.setEndAfter(br);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      editorRef.current.appendChild(container);
      const br = document.createElement("p");
      br.innerHTML = "<br>";
      editorRef.current.appendChild(br);
    }

    checkAndMergeImages(editorRef.current);
    handleEditorInput();
    saveSelection();
  };

  // 5. Insert slider block helper
  const insertSliderBlock = (urls: string[]) => {
    if (!editorRef.current) return;

    editorRef.current.focus();
    restoreSelection();

    const sliderEl = document.createElement("div");
    sliderEl.className = "image-slider-block relative my-4 w-full max-w-[600px] mx-auto";
    sliderEl.setAttribute("contenteditable", "false");
    sliderEl.setAttribute("data-urls", JSON.stringify(urls));

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);

      let parentBlock: HTMLElement | null = null;
      let node = range.startContainer;
      let currentElement = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement;

      while (currentElement && currentElement !== editorRef.current) {
        if (currentElement.parentElement === editorRef.current) {
          parentBlock = currentElement;
          break;
        }
        currentElement = currentElement.parentElement;
      }

      if (parentBlock) {
        const text = parentBlock.textContent?.trim() || "";
        const isEmpty = text === "" && (parentBlock.innerHTML === "" || parentBlock.innerHTML === "<br>");
        if (isEmpty) {
          parentBlock.parentNode?.replaceChild(sliderEl, parentBlock);
        } else {
          parentBlock.after(sliderEl);
        }
      } else {
        range.deleteContents();
        range.insertNode(sliderEl);
      }

      const br = document.createElement("p");
      br.innerHTML = "<br>";
      sliderEl.after(br);

      range.setStartAfter(br);
      range.setEndAfter(br);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      editorRef.current.appendChild(sliderEl);
      const br = document.createElement("p");
      br.innerHTML = "<br>";
      editorRef.current.appendChild(br);
    }

    import("react-dom/client").then(({ createRoot }) => {
      const root = createRoot(sliderEl);
      root.render(
        <SliderBlock
          urls={urls}
          onViewImage={setLightboxUrl}
          onDelete={() => {
            sliderEl.remove();
            handleEditorInput();
          }}
        />
      );
      hydratedRootsRef.current.set(sliderEl, root);
    });

    handleEditorInput();
    saveSelection();
  };

  // 6. Handle multi-file selector upload
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    const uploadToast = toast.loading(`Uploading ${fileList.length} image(s)...`);

    try {
      const urls = await Promise.all(
        fileList.map((file) => uploadImageFile(file))
      );

      const validUrls = urls.filter(Boolean) as string[];
      if (validUrls.length === 0) {
        toast.dismiss(uploadToast);
        return;
      }

      toast.success(`Uploaded ${validUrls.length} image(s) successfully`, { id: uploadToast });

      if (validUrls.length >= 2) {
        insertSliderBlock(validUrls);
      } else {
        validUrls.forEach((url) => insertImageBlock(url));
      }
    } catch (err) {
      toast.error("Failed to upload image(s)", { id: uploadToast });
    }

    e.target.value = "";
  };

  // 7. Handle paste files inside editor
  const handleEditorPaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;

    // Check if there's any image file in the clipboard
    let imageFiles: File[] = [];
    if (items) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault();

      const uploadToast = toast.loading(`Uploading ${imageFiles.length} pasted image(s)...`);
      try {
        const urls = await Promise.all(
          imageFiles.map((file) => uploadImageFile(file))
        );

        const validUrls = urls.filter(Boolean) as string[];
        if (validUrls.length === 0) {
          toast.dismiss(uploadToast);
          return;
        }

        toast.success(`Uploaded ${validUrls.length} pasted image(s) successfully`, { id: uploadToast });

        if (validUrls.length >= 2) {
          insertSliderBlock(validUrls);
        } else {
          validUrls.forEach((url) => insertImageBlock(url));
        }
      } catch (err) {
        toast.error("Failed to upload pasted image(s)", { id: uploadToast });
      }
      return;
    }

    // Process text/HTML copy-paste
    e.preventDefault();
    const html = e.clipboardData?.getData("text/html");
    if (html) {
      const sanitized = sanitizeHtml(html);
      document.execCommand("insertHTML", false, sanitized);
      handleEditorInput();
    } else {
      const text = e.clipboardData?.getData("text/plain");
      if (text) {
        const paragraphs = text
          .split(/\r?\n/)
          .map(line => {
            const trimmed = line.trim();
            if (trimmed === "") return "<p><br></p>";
            const escaped = trimmed
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;");
            return `<p>${escaped}</p>`;
          })
          .join("");

        document.execCommand("insertHTML", false, paragraphs);
        handleEditorInput();
      }
    }
  };

  // 8. Robust selection change listener for empty block plus icon
  useEffect(() => {
    if (typeof window === "undefined" || !editorRef.current) return;

    const updateFloatingMenuPosition = () => {
      // If popover is open, do not change coordinates or hide the menu to prevent race conditions
      if (isPopoverOpenRef.current) return;

      if (!editorRef.current || !currentNote || currentNote.permission_level !== "edit") {
        setFloatingMenuCoords(null);
        activeBlockRef.current = null;
        return;
      }

      const sel = window.getSelection();
      if (!sel || !sel.isCollapsed || sel.rangeCount === 0) {
        setFloatingMenuCoords(null);
        activeBlockRef.current = null;
        return;
      }

      const range = sel.getRangeAt(0);
      const node = range.startContainer;

      let blockElement: HTMLElement | null = null;
      let currentElement = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement;

      // Walk up to find the closest block-level editable element containing the cursor
      while (currentElement && currentElement !== editorRef.current) {
        const tagName = currentElement.tagName.toUpperCase();
        if (["P", "H1", "H2", "H3", "H4", "H5", "H6", "LI", "BLOCKQUOTE"].includes(tagName)) {
          blockElement = currentElement;
          break;
        }
        if (tagName === "DIV" &&
          !currentElement.classList.contains("voice-note-container") &&
          !currentElement.classList.contains("image-slider-block") &&
          !currentElement.classList.contains("editor-image-container") &&
          !currentElement.classList.contains("task-content")) {
          blockElement = currentElement;
          break;
        }
        currentElement = currentElement.parentElement;
      }

      // Fallbacks if no specific element was matched
      if (!blockElement) {
        if (node === editorRef.current) {
          const childNodes = Array.from(editorRef.current.children);
          if (childNodes.length === 0) {
            const p = document.createElement("p");
            p.innerHTML = "<br>";
            editorRef.current.appendChild(p);
            blockElement = p;
          } else {
            const offset = Math.min(range.startOffset, childNodes.length - 1);
            blockElement = childNodes[offset] as HTMLElement;
          }
        } else {
          let fallbackElement = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement;
          while (fallbackElement && fallbackElement.parentElement !== editorRef.current && fallbackElement !== editorRef.current) {
            fallbackElement = fallbackElement.parentElement;
          }
          if (fallbackElement && fallbackElement !== editorRef.current) {
            blockElement = fallbackElement;
          }
        }
      }

      if (!blockElement) {
        setFloatingMenuCoords(null);
        activeBlockRef.current = null;
        return;
      }

      // Check if block element is empty
      const text = (blockElement.textContent || "").replace(/\u200B/g, "").trim();
      const hasWidget = blockElement.querySelector("img") ||
        blockElement.querySelector("table") ||
        blockElement.querySelector(".voice-note-container") ||
        blockElement.querySelector(".image-slider-block");
      const isEmpty = text === "" && !hasWidget;

      if (isEmpty) {
        const editorRect = editorRef.current.getBoundingClientRect();
        const blockRect = blockElement.getBoundingClientRect();
        const parentElement = editorRef.current.parentElement;

        if (parentElement) {
          const parentRect = parentElement.getBoundingClientRect();
          const top = blockRect.top - parentRect.top + parentElement.scrollTop;

          // Determine starting X position, adjusting to the left of checkbox if it's a task item
          const taskLi = blockElement.closest('li[data-type="taskItem"]');
          const checkbox = taskLi?.querySelector('input[type="checkbox"]');

          let targetLeft = blockRect.left;
          if (checkbox) {
            targetLeft = checkbox.getBoundingClientRect().left;
          }

          const left = targetLeft - parentRect.left + parentElement.scrollLeft - 32;
          const height = blockRect.height || 28;

          setFloatingMenuCoords({ top, left: Math.max(8, left), height });
          activeBlockRef.current = blockElement;
        }
      } else {
        setFloatingMenuCoords(null);
        activeBlockRef.current = null;
      }
    };

    const handleEvents = () => {
      setTimeout(updateFloatingMenuPosition, 10);
    };

    document.addEventListener("selectionchange", handleEvents);
    window.addEventListener("resize", handleEvents);

    return () => {
      document.removeEventListener("selectionchange", handleEvents);
      window.removeEventListener("resize", handleEvents);
    };
  }, [currentNote]);

  // 9. Resize and deletion listeners for images
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    // Ensure default paragraph separator is set to <p>
    try {
      document.execCommand("defaultParagraphSeparator", false, "p");
    } catch (e) {
      console.warn("Failed to set defaultParagraphSeparator", e);
    }

    const handleFocus = () => {
      try {
        document.execCommand("defaultParagraphSeparator", false, "p");
      } catch (e) { }
    };
    editor.addEventListener("focus", handleFocus);

    let isResizing = false;
    let startX = 0;
    let startWidth = 0;
    let resizeTarget: HTMLElement | null = null;

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains("image-resize-handle")) {
        e.preventDefault();
        e.stopPropagation();

        const container = target.closest(".editor-image-container") as HTMLElement;
        if (container) {
          isResizing = true;
          startX = e.clientX;
          startWidth = container.getBoundingClientRect().width;
          resizeTarget = container;
          document.body.style.cursor = "se-resize";
        }
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !resizeTarget) return;
      const deltaX = e.clientX - startX;
      const newWidth = Math.max(150, Math.min(800, startWidth + deltaX));
      resizeTarget.style.width = `${newWidth}px`;
    };

    const handleMouseUp = () => {
      if (isResizing) {
        isResizing = false;
        resizeTarget = null;
        document.body.style.cursor = "default";
        handleEditorInput();
      }
    };

    const handleEditorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Handle collapsible heading toggle click in left gutter
      if (target && ["H1", "H2", "H3"].includes(target.tagName)) {
        const rect = target.getBoundingClientRect();
        if (e.clientX >= rect.left - 24 && e.clientX <= rect.left) {
          e.preventDefault();
          e.stopPropagation();
          toggleHeadingCollapse(target);
          return;
        }
      }

      // Handle zoom button click inside editor
      const viewBtn = target.closest(".image-view-btn");
      if (viewBtn) {
        e.preventDefault();
        e.stopPropagation();
        const container = viewBtn.closest(".editor-image-container");
        const img = container?.querySelector("img");
        if (img) {
          setLightboxUrl(img.src);
        }
        return;
      }

      const container = target.closest(".editor-image-container") as HTMLElement;

      editor.querySelectorAll(".editor-image-container").forEach((el) => {
        el.classList.remove("ring-2", "ring-primary", "is-selected");
      });

      if (container) {
        container.classList.add("ring-2", "ring-primary", "is-selected");
        saveSelection();
      }
    };

    const handleDblClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "IMG" && target.closest(".editor-image-container")) {
        const img = target as HTMLImageElement;
        setLightboxUrl(img.src);
      }
    };

    const handleCheckboxChange = (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (target.tagName === "INPUT" && target.type === "checkbox") {
        const li = target.closest('li[data-type="taskItem"]');
        if (li) {
          if (target.checked) {
            target.setAttribute("checked", "checked");
            li.setAttribute("data-checked", "true");
          } else {
            target.removeAttribute("checked");
            li.removeAttribute("data-checked");
          }
          handleEditorInput();
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Backspace" || e.key === "Delete") {
        const selectedImage = editor.querySelector(".editor-image-container.is-selected") as HTMLElement;
        if (selectedImage) {
          e.preventDefault();
          selectedImage.remove();
          handleEditorInput();
          return;
        }
      }

      if (e.key === "Enter") {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          const node = range.startContainer;
          let currentElement = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement;
          const li = currentElement?.closest('li[data-type="taskItem"]');
          if (li) {
            e.preventDefault();

            // Create new task item
            const newLi = document.createElement("li");
            newLi.setAttribute("data-type", "taskItem");
            newLi.className = "flex items-start mb-1";

            const label = document.createElement("label");
            label.setAttribute("contenteditable", "false");
            label.className = "select-none mr-2 mt-1 shrink-0 cursor-pointer";

            const input = document.createElement("input");
            input.type = "checkbox";
            input.className = "task-checkbox";

            const span = document.createElement("span");

            label.appendChild(input);
            label.appendChild(span);

            const contentDiv = document.createElement("div");
            contentDiv.className = "task-content outline-none inline-block min-w-[20px] flex-1";
            contentDiv.innerHTML = "<br>";

            newLi.appendChild(label);
            newLi.appendChild(contentDiv);

            li.after(newLi);

            contentDiv.focus();
            const newRange = document.createRange();
            newRange.setStart(contentDiv, 0);
            newRange.collapse(true);
            sel.removeAllRanges();
            sel.addRange(newRange);

            handleEditorInput();
          }
        }
      }

      if (e.key === "Backspace") {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          const node = range.startContainer;
          let currentElement = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement;
          const li = currentElement?.closest('li[data-type="taskItem"]');
          if (li) {
            const contentDiv = li.querySelector(".task-content");
            if (contentDiv && (contentDiv.textContent === "" || contentDiv.innerHTML === "<br>")) {
              e.preventDefault();

              const parent = li.parentElement;
              const p = document.createElement("p");
              p.innerHTML = "<br>";
              li.parentNode?.replaceChild(p, li);

              p.focus();
              const newRange = document.createRange();
              newRange.setStart(p, 0);
              newRange.collapse(true);
              sel.removeAllRanges();
              sel.addRange(newRange);

              if (parent && parent.tagName === "UL" && parent.getAttribute("data-type") === "taskList" && parent.children.length === 0) {
                parent.remove();
              }

              handleEditorInput();
            }
          }
        }
      }
    };

    editor.addEventListener("focus", handleFocus);
    editor.addEventListener("mousedown", handleMouseDown);
    editor.addEventListener("click", handleEditorClick);
    editor.addEventListener("dblclick", handleDblClick);
    editor.addEventListener("keydown", handleKeyDown);
    editor.addEventListener("change", handleCheckboxChange);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      editor.removeEventListener("focus", handleFocus);
      editor.removeEventListener("mousedown", handleMouseDown);
      editor.removeEventListener("click", handleEditorClick);
      editor.removeEventListener("dblclick", handleDblClick);
      editor.removeEventListener("keydown", handleKeyDown);
      editor.removeEventListener("change", handleCheckboxChange);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [currentNote]);

  const handleFloatingMenuOption = async (option: "voice" | "dictate" | "image" | "text" | "todo" | "table") => {
    isPopoverOpenRef.current = false;
    setIsPopoverOpen(false);
    setFloatingMenuCoords(null);
    if (!editorRef.current || !activeBlockRef.current) return;

    if (option === "voice") {
      if (isRecording) {
        stopRecording();
      } else {
        await startRecording();
        setTimeout(() => {
          editorRef.current?.focus();
          restoreSelection();
        }, 50);
      }
    } else if (option === "dictate") {
      if (isListening) {
        stopListening();
      } else {
        startListening();
        setTimeout(() => {
          editorRef.current?.focus();
          restoreSelection();
        }, 50);
      }
    } else if (option === "image") {
      imageFileInputRef.current?.click();
    } else if (option === "text") {
      const sel = window.getSelection();
      if (sel) {
        const range = document.createRange();
        range.selectNodeContents(activeBlockRef.current);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
      activeBlockRef.current.focus();
    } else if (option === "todo") {
      const ul = document.createElement("ul");
      ul.setAttribute("data-type", "taskList");
      ul.className = "list-none pl-0 my-2";

      const li = document.createElement("li");
      li.setAttribute("data-type", "taskItem");
      li.className = "flex items-start mb-1";

      const label = document.createElement("label");
      label.setAttribute("contenteditable", "false");
      label.className = "select-none mr-2 mt-1 shrink-0 cursor-pointer";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.className = "task-checkbox";

      const span = document.createElement("span");

      label.appendChild(input);
      label.appendChild(span);

      const contentDiv = document.createElement("div");
      contentDiv.className = "task-content outline-none inline-block min-w-[20px] flex-1";
      contentDiv.innerHTML = "<br>";

      li.appendChild(label);
      li.appendChild(contentDiv);
      ul.appendChild(li);

      activeBlockRef.current.parentNode?.replaceChild(ul, activeBlockRef.current);

      contentDiv.focus();
      const sel = window.getSelection();
      if (sel) {
        const range = document.createRange();
        range.setStart(contentDiv, 0);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
      handleEditorInput();
    } else if (option === "table") {
      const table = document.createElement("table");
      table.className = "w-full border-collapse border border-border my-4 table-fixed rounded-xl overflow-hidden text-sm";

      const tbody = document.createElement("tbody");
      for (let r = 0; r < 3; r++) {
        const row = document.createElement("tr");
        for (let c = 0; c < 3; c++) {
          const cell = document.createElement("td");
          cell.className = "border border-border/70 p-2 min-h-[40px] focus:outline-none";
          cell.innerHTML = "&nbsp;";
          row.appendChild(cell);
        }
        tbody.appendChild(row);
      }
      table.appendChild(tbody);

      activeBlockRef.current.parentNode?.replaceChild(table, activeBlockRef.current);

      const p = document.createElement("p");
      p.innerHTML = "<br>";
      table.after(p);

      const firstCell = table.querySelector("td");
      if (firstCell) {
        firstCell.focus();
        const sel = window.getSelection();
        if (sel) {
          const range = document.createRange();
          range.setStart(firstCell, 0);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
      handleEditorInput();
    }
  };

  // Share Dialog state
  const [shareOpen, setShareOpen] = useState(false);
  const [shareSubmitting, setShareSubmitting] = useState(false);
  const [sharingMap, setSharingMap] = useState<Record<string, { selected: boolean; level: "view" | "edit" }>>({});

  // Folder Share Dialog state
  const [shareFolderOpen, setShareFolderOpen] = useState(false);
  const [shareFolderSubmitting, setShareFolderSubmitting] = useState(false);
  const [sharingFolderMap, setSharingFolderMap] = useState<Record<string, { selected: boolean; level: "view" | "edit" }>>({});
  const [activeFolderToShare, setActiveFolderToShare] = useState<NoteFolder | null>(null);

  const unmountSpecificSliders = (el: HTMLElement) => {
    const sliders = el.classList.contains("image-slider-block") ? [el] : Array.from(el.querySelectorAll(".image-slider-block"));
    sliders.forEach((slider) => {
      const root = hydratedRootsRef.current.get(slider);
      if (root) {
        try {
          root.unmount();
        } catch (e) {
          console.error("Failed to unmount slider root:", e);
        }
        hydratedRootsRef.current.delete(slider);
      }
    });
  };

  const hydrateSpecificSliders = (el: HTMLElement) => {
    const sliders = el.classList.contains("image-slider-block") ? [el] : Array.from(el.querySelectorAll(".image-slider-block"));
    sliders.forEach((slider) => {
      const urlsStr = slider.getAttribute("data-urls");
      if (!urlsStr) return;
      try {
        const urls = JSON.parse(urlsStr);
        if (!Array.isArray(urls)) return;
        import("react-dom/client").then(({ createRoot }) => {
          const root = createRoot(slider);
          root.render(
            <SliderBlock
              urls={urls}
              onViewImage={setLightboxUrl}
              onDelete={() => {
                slider.remove();
                handleEditorInput();
              }}
            />
          );
          hydratedRootsRef.current.set(slider, root);
        });
      } catch (e) {
        console.error("Failed to hydrate slider:", e);
      }
    });
  };

  const patchDOM = (target: HTMLElement, source: HTMLElement) => {
    const targetChildren = Array.from(target.childNodes);
    const sourceChildren = Array.from(source.childNodes);

    const maxLength = Math.max(targetChildren.length, sourceChildren.length);
    for (let i = 0; i < maxLength; i++) {
      const targetNode = targetChildren[i];
      const sourceNode = sourceChildren[i];

      if (!targetNode && sourceNode) {
        const clone = sourceNode.cloneNode(true);
        target.appendChild(clone);
        if (clone instanceof HTMLElement) {
          hydrateSpecificSliders(clone);
        }
      } else if (targetNode && !sourceNode) {
        if (targetNode instanceof HTMLElement) {
          unmountSpecificSliders(targetNode);
        }
        targetNode.remove();
      } else if (targetNode && sourceNode) {
        const isTargetEl = targetNode.nodeType === Node.ELEMENT_NODE;
        const isSourceEl = sourceNode.nodeType === Node.ELEMENT_NODE;

        if (isTargetEl && isSourceEl) {
          const targetEl = targetNode as HTMLElement;
          const sourceEl = sourceNode as HTMLElement;

          const isSlider = targetEl.classList.contains("image-slider-block");
          if (isSlider) {
            const targetUrls = targetEl.getAttribute("data-urls");
            const sourceUrls = sourceEl.getAttribute("data-urls");
            if (targetUrls !== sourceUrls) {
              unmountSpecificSliders(targetEl);
              const clone = sourceEl.cloneNode(true);
              target.replaceChild(clone, targetEl);
              if (clone instanceof HTMLElement) {
                hydrateSpecificSliders(clone);
              }
            }
          } else {
            if (targetEl.tagName !== sourceEl.tagName) {
              unmountSpecificSliders(targetEl);
              const clone = sourceEl.cloneNode(true);
              target.replaceChild(clone, targetEl);
              if (clone instanceof HTMLElement) {
                hydrateSpecificSliders(clone);
              }
            } else {
              if (targetEl.children.length === 0 && sourceEl.children.length === 0) {
                if (targetEl.innerHTML !== sourceEl.innerHTML) {
                  targetEl.innerHTML = sourceEl.innerHTML;
                }
              } else {
                patchDOM(targetEl, sourceEl);
              }
            }
          }
        } else {
          if (targetNode.nodeValue !== sourceNode.nodeValue) {
            targetNode.nodeValue = sourceNode.nodeValue;
          }
        }
      }
    }
  };

  const applyRemoteHtml = (newHtml: string) => {
    if (!editorRef.current) return;
    isSyncingRef.current = true;
    try {
      const savedOffset = getSelectionCharacterOffsetWithin(editorRef.current);
      const parser = new DOMParser();
      const parsedDoc = parser.parseFromString(newHtml, "text/html");
      const sourceBody = parsedDoc.body;

      patchDOM(editorRef.current, sourceBody);

      if (savedOffset) {
        setSelectionCharacterOffsetWithin(editorRef.current, savedOffset);
      }
    } catch (err) {
      console.error("Failed to apply remote HTML:", err);
    } finally {
      isSyncingRef.current = false;
    }
  };

  const calculateCursorCoords = (offset: number | undefined) => {
    if (offset === undefined || !editorRef.current) return null;
    const element = editorRef.current;

    let charIndex = 0;
    const range = document.createRange();

    const nodeQueue: Node[] = [element];
    let foundNode: Node | null = null;
    let foundOffset = 0;

    while (nodeQueue.length > 0) {
      const node = nodeQueue.shift()!;
      if (node.nodeType === Node.TEXT_NODE) {
        const nextCharIndex = charIndex + node.textContent!.length;
        if (offset >= charIndex && offset <= nextCharIndex) {
          foundNode = node;
          foundOffset = offset - charIndex;
          break;
        }
        charIndex = nextCharIndex;
      } else {
        const childNodes = Array.from(node.childNodes);
        for (let i = childNodes.length - 1; i >= 0; i--) {
          nodeQueue.unshift(childNodes[i]);
        }
      }
    }

    if (foundNode) {
      try {
        range.setStart(foundNode, foundOffset);
        range.collapse(true);
        const rect = range.getBoundingClientRect();
        const parentElement = editorRef.current.parentElement;
        if (parentElement) {
          const parentRect = parentElement.getBoundingClientRect();
          return {
            top: rect.top - parentRect.top + parentElement.scrollTop,
            left: rect.left - parentRect.left + parentElement.scrollLeft,
            height: rect.height || 20
          };
        }
      } catch (e) {
        // Ignore range exceptions
      }
    }
    return null;
  };

  // Setup real-time collaborative doc replication
  useEffect(() => {
    if (!currentNote || currentNote.permission_level !== "edit" || !profile) {
      setActiveUsers([]);
      activeUsersRef.current = [];
      setRemoteCursors([]);
      return;
    }

    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;
    const ytext = ydoc.getText("content");

    // Initialize custom Supabase Yjs Provider
    const provider = new SupabaseYjsProvider(
      ydoc,
      supabase,
      `realtime:note_collaboration:${currentNote.id}`,
      profile.id,
      profile.full_name || "Anonymous Staff",
      profile.avatar_url,
      (users) => {
        const uniqueUsers = Array.from(new Map(users.map(u => [u.user_id, u])).values());
        setActiveUsers(uniqueUsers);
        activeUsersRef.current = uniqueUsers;
      },
      (cursorData) => {
        setRemoteCursors((prev) => {
          const filtered = prev.filter(c => c.userId !== cursorData.userId);
          if (cursorData.offset) {
            return [...filtered, cursorData];
          }
          return filtered;
        });
      }
    );
    yproviderRef.current = provider;

    // Timeout: if no remote updates after subscription, populate with db state
    const initTimeout = setTimeout(() => {
      if (ydocRef.current && ydocRef.current.getText("content").length === 0) {
        // Only seed document if we are the first/only user in presence list to prevent duplication
        const users = activeUsersRef.current;
        const sortedUsers = [...users].sort((a, b) => a.user_id.localeCompare(b.user_id));
        const isFirstUser = sortedUsers.length === 0 || sortedUsers[0]?.user_id === profile.id;

        if (isFirstUser) {
          ydocRef.current.transact(() => {
            ydocRef.current!.getText("content").insert(0, currentNote.content || "<p><br></p>");
          }, provider);
          hasSeededRef.current = true;
        } else {
          hasSeededRef.current = true;
        }
      } else {
        hasSeededRef.current = true;
      }
    }, 1000);

    const handleRemoteChange = (event: any, transaction: any) => {
      // If the change is local, we don't need to patch our own editor DOM
      if (transaction.local) return;
      if (isSyncingRef.current) return;

      const remoteHtml = ytext.toString();

      // Prevent sync race condition: if remote Yjs document is empty but we have existing database content,
      // do not let the empty sync wipe our editor. Instead, push our editor contents to the Yjs doc.
      if (!isInitialSyncDoneRef.current && (remoteHtml === "" || remoteHtml === "<p><br></p>")) {
        const localHtml = editorRef.current?.innerHTML || "";
        if (localHtml && localHtml !== "<p><br></p>") {
          isInitialSyncDoneRef.current = true;
          hasSeededRef.current = true;
          ydoc.transact(() => {
            ytext.delete(0, ytext.length);
            ytext.insert(0, localHtml);
          }, provider);
          return;
        }
      }

      if (remoteHtml) {
        loadFontsFromHtml(remoteHtml, (font) => {
          setDynamicallyLoadedFonts(prev => prev.includes(font) ? prev : [...prev, font]);
        });
      }

      isInitialSyncDoneRef.current = true;
      hasSeededRef.current = true;
      applyRemoteHtml(remoteHtml);
    };
    ytext.observe(handleRemoteChange);

    return () => {
      clearTimeout(initTimeout);
      ytext.unobserve(handleRemoteChange);
      if (yproviderRef.current) {
        yproviderRef.current.destroy();
        yproviderRef.current = null;
      }
      if (ydocRef.current) {
        ydocRef.current.destroy();
        ydocRef.current = null;
      }
      setActiveUsers([]);
      activeUsersRef.current = [];
      setRemoteCursors([]);
    };
  }, [currentNote?.id, profile]);

  useEffect(() => {
    void loadNotes();
    void loadClients();
    void loadNoteFolders();
    void loadActiveStaff();
  }, []);

  // Restore editor view on reload if noteId is in URL
  useEffect(() => {
    if (typeof window === "undefined" || notes.length === 0 || currentNote) return;
    const urlParams = new URLSearchParams(window.location.search);
    const noteId = urlParams.get("noteId");
    if (noteId) {
      const foundNote = notes.find(n => n.id === noteId);
      if (foundNote) {
        handleOpenEditor(foundNote);
      }
    }
  }, [notes]);

  useEffect(() => {
    setIsFoldersExpanded(false);
    setVisibleNotesCount(21);
  }, [searchQuery, activeFolderId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saveStatus === "unsaved") {
        e.preventDefault();
        e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [saveStatus]);

  // Preserves text selection selection change listener to handle external dropdown clicks smoothly
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || !editorRef.current) return;

      const range = sel.getRangeAt(0);

      // Ensure the selection is actually inside the editorRef container
      if (editorRef.current.contains(range.commonAncestorContainer)) {
        savedSelectionRef.current = range.cloneRange();

        // Broadcast local cursor offset for collaborative carets
        if (yproviderRef.current && !isSyncingRef.current) {
          const offset = getSelectionCharacterOffsetWithin(editorRef.current);
          yproviderRef.current.broadcastCursor(offset);
        }
      }
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, []);

  async function fetchWithAuth(urlStr: string, options: RequestInit = {}) {
    const { data: { session } } = await supabase.auth.getSession();
    const headers = new Headers(options.headers);
    if (session?.access_token) {
      headers.set("Authorization", `Bearer ${session.access_token}`);
    }
    return fetch(urlStr, { ...options, headers });
  }

  async function loadNotes() {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/notes");
      if (!res.ok) throw new Error("Failed to load notes data");
      const data = await res.json();
      setNotes(data || []);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to load notes list");
    } finally {
      setLoading(false);
    }
  }

  async function loadClients() {
    try {
      const res = await fetchWithAuth("/api/vault/folders");
      if (!res.ok) throw new Error("Failed to load clients list");
      const data = await res.json();
      setClients(data || []);
    } catch (err) {
      console.error("Error loading clients:", err);
    }
  }

  async function loadNoteFolders() {
    try {
      const res = await fetchWithAuth("/api/notes/folders");
      if (!res.ok) throw new Error("Failed to load folders list");
      const data = await res.json();
      setFolders(data || []);
    } catch (err) {
      console.error("Error loading note folders:", err);
    }
  }

  async function loadActiveStaff() {
    try {
      const { data: roleData } = await supabase
        .from("user_roles" as any)
        .select("user_id")
        .in("role", ["staff", "project_manager", "admin", "super_admin"]);

      const userIds = [...new Set((roleData || []).map((r: any) => r.user_id as string))];
      if (userIds.length === 0) return;

      const { data: activeEmps } = await supabase
        .from("employees" as any)
        .select("profile_id")
        .in("profile_id", userIds)
        .neq("status", "disabled");

      const activeProfileIds = (activeEmps || []).map((e: any) => e.profile_id).filter(Boolean);
      if (activeProfileIds.length === 0) return;

      const { data: staffProfiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", activeProfileIds)
        .order("full_name");

      setActiveStaff(staffProfiles || []);
    } catch (err) {
      console.error("Error loading active staff:", err);
    }
  }

  const handleRefreshAll = async () => {
    const refreshToast = toast.loading("Refreshing notes dashboard...");
    try {
      await Promise.all([
        loadNotes(),
        loadClients(),
        loadNoteFolders(),
        loadActiveStaff()
      ]);
      toast.success("Notes dashboard updated successfully", { id: refreshToast });
    } catch (err) {
      toast.error("Failed to refresh dashboard data", { id: refreshToast });
    }
  };

  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createTitle.trim()) {
      toast.error("Document title is required");
      return;
    }
    setCreating(true);
    try {
      const targetClientId = createClientId === "none" ? null : createClientId;
      const targetFolderId = createFolderId === "none" ? null : createFolderId;

      const res = await fetchWithAuth("/api/notes", {
        method: "POST",
        body: JSON.stringify({
          title: createTitle.trim(),
          client_id: targetClientId || null,
          folder_id: targetFolderId || null,
          content: "<p>Start writing your document here...</p>"
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create document");
      }
      const result = await res.json();
      toast.success("Document created successfully");

      setCreateTitle("");
      setCreateClientId("");
      setCreateFolderId("");
      setCreateOpen(false);
      await loadNotes();

      // Automatically open the editor for this newly created note
      const resNotes = await fetchWithAuth("/api/notes");
      if (resNotes.ok) {
        const notesList: NoteRow[] = await resNotes.json();
        const found = notesList.find(n => n.id === result.id);
        if (found) {
          handleOpenEditor(found);
        }
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to create document");
    } finally {
      setCreating(false);
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return toast.error("Folder name is required");
    setCreatingFolder(true);
    try {
      const targetParentFolder = newFolderParentId !== "none" ? folders.find(f => f.id === newFolderParentId) : null;
      const targetClientId = targetParentFolder ? targetParentFolder.client_id : (newFolderClientId === "none" ? null : newFolderClientId);
      const targetParentId = newFolderParentId === "none" ? null : newFolderParentId;

      const res = await fetchWithAuth("/api/notes/folders", {
        method: "POST",
        body: JSON.stringify({
          name: newFolderName.trim(),
          client_id: targetClientId,
          parent_id: targetParentId
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create folder");
      }
      toast.success("Folder created successfully");
      setNewFolderName("");
      setNewFolderClientId("none");
      setNewFolderParentId("none");
      setCreateFolderOpen(false);
      void loadNoteFolders();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to create folder");
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleMoveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setMovingItem(true);
    try {
      const targetFolderId = moveTargetFolderId === "none" ? null : moveTargetFolderId;

      if (moveItemType === "note") {
        const note = notes.find(n => n.id === moveItemId);
        if (!note) return;

        const res = await fetchWithAuth("/api/notes", {
          method: "PUT",
          body: JSON.stringify({
            id: note.id,
            title: note.title,
            content: note.content,
            client_id: note.client_id,
            folder_id: targetFolderId
          })
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to move note");
        }
        toast.success("Document moved successfully");
        await loadNotes();
      } else {
        const folder = folders.find(f => f.id === moveItemId);
        if (!folder) return;

        const res = await fetchWithAuth("/api/notes/folders", {
          method: "PUT",
          body: JSON.stringify({
            id: folder.id,
            parent_id: targetFolderId
          })
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to move folder");
        }
        toast.success("Folder moved successfully");
        await loadNoteFolders();
        await loadNotes();
      }
      setMoveOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to move item");
    } finally {
      setMovingItem(false);
    }
  };

  const handleOpenMoveFolder = (folderId: string, currentParentId: string | null) => {
    setMoveItemId(folderId);
    setMoveItemType("folder");
    setMoveTargetFolderId(currentParentId || "none");
    setMoveOpen(true);
  };

  const handleOpenMoveNote = (noteId: string, currentFolderId: string | null) => {
    setMoveItemId(noteId);
    setMoveItemType("note");
    setMoveTargetFolderId(currentFolderId || "none");
    setMoveOpen(true);
  };

  const handleRenameFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameFolderName.trim()) return toast.error("Folder name is required");
    setRenamingFolder(true);
    try {
      const res = await fetchWithAuth("/api/notes/folders", {
        method: "PUT",
        body: JSON.stringify({
          id: renameFolderId,
          name: renameFolderName.trim()
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to rename folder");
      }
      toast.success("Folder renamed successfully");
      setRenameFolderId("");
      setRenameFolderName("");
      setRenameFolderOpen(false);
      void loadNoteFolders();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to rename folder");
    } finally {
      setRenamingFolder(false);
    }
  };

  const handleDeleteFolder = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete folder "${name}"? Notes inside it will be preserved but set as root/folder-less.`)) {
      return;
    }
    try {
      const res = await fetchWithAuth(`/api/notes/folders?id=${id}`, {
        method: "DELETE"
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete folder");
      }
      toast.success("Folder deleted successfully");
      if (activeFolderId === id) {
        setActiveFolderId(null);
      }
      void loadNoteFolders();
      void loadNotes();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to delete folder");
    }
  };

  const handleDeleteDocument = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete document "${title}"?`)) {
      return;
    }
    try {
      const res = await fetchWithAuth(`/api/notes?id=${id}`, {
        method: "DELETE"
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete document");
      }
      toast.success("Document deleted successfully");

      setOpenNotes((prev) => prev.filter((n) => n.id !== id));
      if (currentNote?.id === id) {
        setCurrentNote(null);
      }

      void loadNotes();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to delete document");
    }
  };

  const handleOpenEditor = (note: NoteRow) => {
    setCurrentNote(note);
    setEditorTitle(note.title);
    setEditorClientId(note.client_id || "");
    setEditorFolderId(note.folder_id || "");
    setSaveStatus("saved");
    setSelectedFont("Inter");
    setSelectedColor("#000000");
    savedSelectionRef.current = null;
    hasSeededRef.current = false;
    isInitialSyncDoneRef.current = false;

    setOpenNotes((prev) => {
      if (prev.some((n) => n.id === note.id)) return prev;
      return [...prev, note];
    });

    if (note.content) {
      loadFontsFromHtml(note.content, (font) => {
        setDynamicallyLoadedFonts(prev => prev.includes(font) ? prev : [...prev, font]);
      });
    }

    if (typeof window !== "undefined") {
      window.history.pushState({}, "", `/notes?noteId=${note.id}`);
    }

    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = note.content || "<p><br></p>";
        hydrateSliders(editorRef.current);
      }
    }, 50);
  };

  const handleSwitchTab = async (targetNote: NoteRow) => {
    if (currentNote && currentNote.id === targetNote.id) return;

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    if (saveStatus === "unsaved" && currentNote) {
      setSaveStatus("saving");
      await saveDocumentData(
        currentNote.id,
        editorTitle,
        editorClientId,
        editorFolderId,
        editorRef.current?.innerHTML || ""
      );
    }

    hydratedRootsRef.current.forEach((root) => {
      try { root.unmount(); } catch (e) { console.error(e); }
    });
    hydratedRootsRef.current.clear();

    handleOpenEditor(targetNote);
  };

  const handleCloseTab = async (noteId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }

    const isActive = currentNote?.id === noteId;

    if (isActive) {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      if (saveStatus === "unsaved" && currentNote) {
        setSaveStatus("saving");
        await saveDocumentData(
          currentNote.id,
          editorTitle,
          editorClientId,
          editorFolderId,
          editorRef.current?.innerHTML || ""
        );
      }
      hydratedRootsRef.current.forEach((root) => {
        try { root.unmount(); } catch (e) { console.error(e); }
      });
      hydratedRootsRef.current.clear();
    }

    const updatedTabs = openNotes.filter(n => n.id !== noteId);
    setOpenNotes(updatedTabs);

    if (isActive) {
      if (updatedTabs.length > 0) {
        const lastTab = updatedTabs[updatedTabs.length - 1];
        handleOpenEditor(lastTab);
      } else {
        if (typeof window !== "undefined") {
          window.history.pushState({}, "", "/notes");
        }
        setCurrentNote(null);
        void loadNotes();
      }
    }
  };

  const handleBackToDashboard = async () => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Unmount roots
    hydratedRootsRef.current.forEach((root) => {
      try { root.unmount(); } catch (e) { console.error(e); }
    });
    hydratedRootsRef.current.clear();

    if (saveStatus === "unsaved" && currentNote) {
      setSaveStatus("saving");
      await saveDocumentData(
        currentNote.id,
        editorTitle,
        editorClientId,
        editorFolderId,
        editorRef.current?.innerHTML || ""
      );
    }

    if (typeof window !== "undefined") {
      window.history.pushState({}, "", "/notes");
    }

    setCurrentNote(null);
    void loadNotes();
  };

  const saveDocumentData = async (id: string, titleStr: string, clientStr: string, folderStr: string, contentStr: string, existingAudioUrl?: string | null) => {
    try {
      const originalNote = notes.find(n => n.id === id);
      const sharedStaff = originalNote ? originalNote.shared_with.map(s => ({
        staff_id: s.staff_id,
        permission_level: s.permission_level
      })) : [];

      let audio_url = existingAudioUrl;
      if (audioBlob) {
        setSaveStatus("saving");
        const uploadedUrl = await uploadAudio(id);
        if (uploadedUrl) {
          audio_url = uploadedUrl;
          setAudioBlob(null); // Clear blob after upload
        }
      }

      const res = await fetchWithAuth("/api/notes", {
        method: "PUT",
        body: JSON.stringify({
          id,
          title: titleStr.trim(),
          content: contentStr,
          client_id: clientStr || null,
          folder_id: folderStr || null,
          shared_staff: sharedStaff,
          audio_url
        })
      });

      if (!res.ok) {
        throw new Error("Failed to save draft");
      }
      setSaveStatus("saved");
    } catch (err) {
      console.error("Autosave failed:", err);
      setSaveStatus("unsaved");
    }
  };

  const toggleHeadingCollapse = (heading: HTMLElement) => {
    const isCollapsed = heading.classList.toggle("is-collapsed");
    
    let next = heading.nextElementSibling as HTMLElement | null;
    const headingLevel = parseInt(heading.tagName.substring(1));
    let skipUntilLevel = 0;
    
    while (next) {
      if (["H1", "H2", "H3"].includes(next.tagName)) {
        const nextLevel = parseInt(next.tagName.substring(1));
        if (nextLevel <= headingLevel) {
          break;
        }
        
        if (!isCollapsed) {
          if (skipUntilLevel > 0 && nextLevel <= skipUntilLevel) {
            skipUntilLevel = 0;
          }
          if (next.classList.contains("is-collapsed")) {
            skipUntilLevel = nextLevel;
          }
        }
      }
      
      if (isCollapsed) {
        next.classList.add("collapsed-hidden");
      } else {
        if (skipUntilLevel === 0) {
          next.classList.remove("collapsed-hidden");
        }
      }
      
      next = next.nextElementSibling as HTMLElement | null;
    }
    
    handleEditorInput();
  };

  const handleToggleFolderPin = async (folder: NoteFolder) => {
    try {
      const res = await fetchWithAuth("/api/notes/folders", {
        method: "PATCH",
        body: JSON.stringify({
          id: folder.id,
          is_pinned: !folder.is_pinned
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update folder pin status");
      }
      toast.success(folder.is_pinned ? "Folder unpinned" : "Folder pinned to top");
      void loadNoteFolders();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to update folder pin status");
    }
  };

  const handleToggleFolderFavorite = async (folder: NoteFolder) => {
    try {
      const res = await fetchWithAuth("/api/notes/folders", {
        method: "PATCH",
        body: JSON.stringify({
          id: folder.id,
          is_favorite: !folder.is_favorite
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update folder favorite status");
      }
      toast.success(folder.is_favorite ? "Folder removed from favorites" : "Folder added to favorites");
      void loadNoteFolders();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to update folder favorite status");
    }
  };

  const handleToggleNotePin = async (note: NoteRow) => {
    try {
      const res = await fetchWithAuth("/api/notes", {
        method: "PATCH",
        body: JSON.stringify({
          id: note.id,
          is_pinned: !note.is_pinned
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update note pin status");
      }
      toast.success(note.is_pinned ? "Note unpinned" : "Note pinned to top");
      void loadNotes();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to update note pin status");
    }
  };

  const handleToggleNoteFavorite = async (note: NoteRow) => {
    try {
      const res = await fetchWithAuth("/api/notes", {
        method: "PATCH",
        body: JSON.stringify({
          id: note.id,
          is_favorite: !note.is_favorite
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update note favorite status");
      }
      toast.success(note.is_favorite ? "Note removed from favorites" : "Note added to favorites");
      void loadNotes();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to update note favorite status");
    }
  };

  const handleEditorInput = () => {
    if (!currentNote || currentNote.permission_level !== "edit") return;
    setSaveStatus("unsaved");

    // Push local diff updates to Yjs document
    if (ydocRef.current && !isSyncingRef.current) {
      const ytext = ydocRef.current.getText("content");
      const currentHtml = editorRef.current?.innerHTML || "";
      const ytextHtml = ytext.toString();

      if (currentHtml !== ytextHtml) {
        let start = 0;
        while (start < ytextHtml.length && start < currentHtml.length && ytextHtml[start] === currentHtml[start]) {
          start++;
        }

        let end1 = ytextHtml.length;
        let end2 = currentHtml.length;
        while (end1 > start && end2 > start && ytextHtml[end1 - 1] === currentHtml[end2 - 1]) {
          end1--;
          end2--;
        }

        const deletedLength = end1 - start;
        const insertedText = currentHtml.slice(start, end2);

        ydocRef.current.transact(() => {
          if (deletedLength > 0) {
            ytext.delete(start, deletedLength);
          }
          if (insertedText.length > 0) {
            ytext.insert(start, insertedText);
          }
        }, "local");
      }
    }

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(() => {
      setSaveStatus("saving");
      void saveDocumentData(
        currentNote.id,
        editorTitle,
        editorClientId,
        editorFolderId,
        editorRef.current?.innerHTML || "",
        currentNote.audio_url
      );
    }, 2000);
  };

  const handleEditorSelectionUpdate = () => {
    if (typeof window === "undefined" || !editorRef.current) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    if (editorRef.current.contains(range.commonAncestorContainer)) {
      // 1. Format Painter Application
      if (isFormatPainterActive && !sel.isCollapsed) {
        // Defer execution to next tick to resolve UI event blocking and lag
        setTimeout(() => {
          try {
            const styles = copiedStylesRef.current;

            // Clear any existing custom formatting on the target selection first to avoid toggle bugs
            document.execCommand("removeFormat");

            document.execCommand("styleWithCSS", false, "true");

            if (styles.bold) {
              document.execCommand("bold");
            }
            if (styles.italic) {
              document.execCommand("italic");
            }
            if (styles.underline) {
              document.execCommand("underline");
            }
            if (styles.fontName) {
              document.execCommand("fontName", false, styles.fontName);
            }
            if (styles.foreColor) {
              document.execCommand("foreColor", false, styles.foreColor);
            }
            if (styles.highlightColor) {
              document.execCommand("backColor", false, styles.highlightColor === "transparent" ? "rgba(0,0,0,0)" : styles.highlightColor);
            }
            if (styles.fontSizeAttr) {
              try {
                document.execCommand("styleWithCSS", false, "false");
                document.execCommand("fontSize", false, styles.fontSizeAttr);
                document.execCommand("styleWithCSS", false, "true");
              } catch (e) {
                console.error(e);
              }
            }

            setIsFormatPainterActive(false);
            copiedStylesRef.current = {};
            toast.success("Format applied successfully!");
            handleEditorInput();
          } catch (err) {
            console.error("Error applying format painter styles:", err);
          }
        }, 0);
        return;
      }

      // 2. Dynamic Table Cell and Cursor Detection
      try {
        const node = sel.anchorNode;
        let currentElement = node?.nodeType === Node.ELEMENT_NODE ? (node as Element) : node?.parentElement;

        let foundTable = false;
        let activeCell: HTMLTableCellElement | null = null;
        while (currentElement && editorRef.current && editorRef.current.contains(currentElement)) {
          if (currentElement.tagName === "TD" || currentElement.tagName === "TH") {
            activeCell = currentElement as HTMLTableCellElement;
          }
          if (currentElement.tagName === "TABLE") {
            foundTable = true;
            break;
          }
          currentElement = currentElement.parentElement;
        }

        setIsInsideTable(foundTable);
        activeCellRef.current = activeCell;
      } catch (err) {
        console.error("Error detecting table cell:", err);
      }

      // 3. Normal dynamic toolbar selection sync
      try {
        const node = sel.anchorNode;
        const element = node?.nodeType === Node.ELEMENT_NODE ? (node as Element) : node?.parentElement;
        if (element) {
          const computedStyle = window.getComputedStyle(element);

          // Detect Font Family
          const computedFont = computedStyle.fontFamily;
          const fontNames = computedFont.split(',').map(f => f.replace(/['"]/g, "").trim());
          const matchedFont = fontNames.find(name => SUPPORTED_FONTS.includes(name));
          if (matchedFont) {
            setSelectedFont(matchedFont);
          } else {
            setSelectedFont("Inter");
          }

          // Detect Font Size
          const computedFontSize = computedStyle.fontSize;
          if (computedFontSize && computedFontSize.endsWith("px")) {
            const parsedSize = Math.round(parseFloat(computedFontSize));
            setSelectedFontSize(String(parsedSize));
          } else {
            const fontNode = element.closest("font");
            if (fontNode) {
              const sizeAttr = fontNode.getAttribute("size");
              if (sizeAttr === "1") setSelectedFontSize("12");
              else if (sizeAttr === "2") setSelectedFontSize("14");
              else if (sizeAttr === "3") setSelectedFontSize("16");
              else if (sizeAttr === "4") setSelectedFontSize("18");
              else if (sizeAttr === "5") setSelectedFontSize("24");
              else if (sizeAttr === "6") setSelectedFontSize("32");
              else if (sizeAttr === "7") setSelectedFontSize("48");
            } else {
              setSelectedFontSize("16");
            }
          }

          // Detect Color
          const computedColor = computedStyle.color;
          const hex = rgbToHex(computedColor);
          setSelectedColor(hex || "#000000");

          // Detect Highlight Color
          const computedBgColor = computedStyle.backgroundColor;
          if (computedBgColor && computedBgColor !== "rgba(0, 0, 0, 0)" && computedBgColor !== "transparent") {
            const bgHex = rgbToHex(computedBgColor);
            setSelectedHighlightColor(bgHex);
          } else {
            setSelectedHighlightColor("transparent");
          }

          // Detect Alignment
          const computedAlign = computedStyle.textAlign;
          if (computedAlign === "center") {
            setSelectedAlignment("center");
          } else if (computedAlign === "right") {
            setSelectedAlignment("right");
          } else if (computedAlign === "justify") {
            setSelectedAlignment("justify");
          } else {
            setSelectedAlignment("left");
          }

          // Detect Line Spacing
          const computedLineHeight = computedStyle.lineHeight;
          if (computedLineHeight) {
            if (computedLineHeight === "normal") {
              setSelectedLineSpacing("1.15");
            } else if (computedLineHeight.endsWith("px")) {
              const lhVal = parseFloat(computedLineHeight);
              const fsVal = parseFloat(computedStyle.fontSize);
              if (!isNaN(lhVal) && !isNaN(fsVal) && fsVal > 0) {
                const ratio = lhVal / fsVal;
                if (ratio < 1.1) setSelectedLineSpacing("1.0");
                else if (ratio < 1.3) setSelectedLineSpacing("1.15");
                else if (ratio < 1.7) setSelectedLineSpacing("1.5");
                else setSelectedLineSpacing("2.0");
              }
            } else {
              const val = parseFloat(computedLineHeight);
              if (!isNaN(val)) {
                if (val < 1.1) setSelectedLineSpacing("1.0");
                else if (val < 1.3) setSelectedLineSpacing("1.15");
                else if (val < 1.7) setSelectedLineSpacing("1.5");
                else setSelectedLineSpacing("2.0");
              }
            }
          }

          // Detect Paragraph Spacing (Margins before/after)
          const blockNodeForMargins = element.closest("p, div, h1, h2, h3, li, td");
          if (blockNodeForMargins) {
            const blockElement = blockNodeForMargins as HTMLElement;
            const isLi = blockElement.tagName.toUpperCase() === "LI";
            if (isLi) {
              setHasSpaceBefore(blockElement.style.marginTop === "16px");
              setHasSpaceAfter(blockElement.style.marginBottom === "16px");
            } else {
              setHasSpaceBefore(blockElement.style.paddingTop === "16px");
              setHasSpaceAfter(blockElement.style.paddingBottom === "16px");
            }
          } else {
            setHasSpaceBefore(false);
            setHasSpaceAfter(false);
          }

          // Detect Block Format
          const blockNode = element.closest("h1, h2, h3, p");
          if (blockNode) {
            const tag = blockNode.tagName.toLowerCase();
            const fontSize = computedStyle.fontSize;
            const sizePx = parseInt(fontSize);
            if (tag === "h1") {
              if (sizePx >= 28) setSelectedBlockFormat("title");
              else setSelectedBlockFormat("h1");
            } else if (tag === "h2") {
              if (sizePx >= 20 && sizePx < 28) setSelectedBlockFormat("subtitle");
              else setSelectedBlockFormat("h2");
            } else {
              setSelectedBlockFormat(tag);
            }
          } else {
            setSelectedBlockFormat("p");
          }
        }
      } catch (e) {
        console.error("Error querying styles:", e);
      }
    }
  };

  const handleFormatPainterClick = () => {
    if (isFormatPainterActive) {
      setIsFormatPainterActive(false);
      copiedStylesRef.current = {};
      toast.info("Paint format disabled");
    } else {
      if (typeof window === "undefined") return;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || !editorRef.current) return;

      const range = sel.getRangeAt(0);
      if (editorRef.current.contains(range.commonAncestorContainer)) {
        try {
          const node = sel.anchorNode;
          const element = node?.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node?.parentElement;

          if (element) {
            const computedStyle = window.getComputedStyle(element);

            const isBold = computedStyle.fontWeight === "bold" ||
              parseInt(computedStyle.fontWeight) >= 700 ||
              element.closest("strong, b") !== null;

            const isItalic = computedStyle.fontStyle === "italic" ||
              element.closest("em, i") !== null;

            const isUnderline = computedStyle.textDecoration.includes("underline") ||
              computedStyle.textDecorationLine?.includes("underline") ||
              element.closest("u") !== null;

            const fontName = computedStyle.fontFamily;
            const foreColor = computedStyle.color;
            const fontSize = computedStyle.fontSize;

            // Map font size to execCommand values (1-7)
            let matchedSizeAttr = "3";
            const sizePx = parseInt(fontSize);
            if (!isNaN(sizePx)) {
              if (sizePx <= 12) matchedSizeAttr = "1";
              else if (sizePx <= 14) matchedSizeAttr = "2";
              else if (sizePx <= 16) matchedSizeAttr = "3";
              else if (sizePx <= 20) matchedSizeAttr = "4";
              else if (sizePx <= 28) matchedSizeAttr = "5";
              else if (sizePx <= 38) matchedSizeAttr = "6";
              else matchedSizeAttr = "7";
            }

            const hexColor = rgbToHex(foreColor);
            const fontNames = fontName.split(',').map(f => f.replace(/['"]/g, "").trim());
            const matchedFont = fontNames.find(name => SUPPORTED_FONTS.includes(name));
            const computedBgColor = computedStyle.backgroundColor;
            const bgHexColor = (computedBgColor && computedBgColor !== "rgba(0, 0, 0, 0)" && computedBgColor !== "transparent")
              ? rgbToHex(computedBgColor)
              : "transparent";

            copiedStylesRef.current = {
              bold: isBold,
              italic: isItalic,
              underline: isUnderline,
              fontName: matchedFont || "inherit",
              foreColor: hexColor || "inherit",
              highlightColor: bgHexColor,
              fontSizeAttr: matchedSizeAttr
            };

            setIsFormatPainterActive(true);
            toast.success("Format copied! Select text to apply.");
          }
        } catch (err) {
          console.error("Error copying format:", err);
        }
      } else {
        toast.error("Please click inside the editor first to select a format.");
      }
    }
  };

  const insertTable = (rowsCount: number, colsCount: number) => {
    if (typeof window === "undefined" || !editorRef.current) return;

    const table = document.createElement("table");
    table.className = "w-full border-collapse border border-border my-4 table-fixed rounded-xl overflow-hidden text-sm";

    const tbody = document.createElement("tbody");
    for (let r = 0; r < rowsCount; r++) {
      const row = document.createElement("tr");
      for (let c = 0; c < colsCount; c++) {
        const cell = document.createElement("td");
        cell.className = "border border-border/70 p-2 min-h-[40px] focus:outline-none";
        cell.innerHTML = "&nbsp;";
        row.appendChild(cell);
      }
      tbody.appendChild(row);
    }
    table.appendChild(tbody);

    restoreSelection();

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (editorRef.current.contains(range.commonAncestorContainer)) {
        range.deleteContents();
        range.insertNode(table);

        const p = document.createElement("p");
        p.innerHTML = "<br>";
        table.after(p);

        const firstCell = table.querySelector("td");
        if (firstCell) {
          const newRange = document.createRange();
          newRange.setStart(firstCell, 0);
          newRange.collapse(true);
          sel.removeAllRanges();
          sel.addRange(newRange);
          firstCell.focus();
        }

        handleEditorInput();
        saveSelection();
      }
    }
  };

  const insertRowAbove = () => {
    const cell = activeCellRef.current;
    if (!cell) return;
    const row = cell.parentElement as HTMLTableRowElement;
    const tbody = row.parentElement as HTMLTableSectionElement;
    const newRow = document.createElement("tr");

    const cellCount = row.cells.length;
    for (let i = 0; i < cellCount; i++) {
      const newCell = document.createElement("td");
      newCell.className = "border border-border/70 p-2 min-h-[40px] focus:outline-none";
      newCell.innerHTML = "&nbsp;";
      newRow.appendChild(newCell);
    }

    tbody.insertBefore(newRow, row);
    handleEditorInput();
  };

  const insertRowBelow = () => {
    const cell = activeCellRef.current;
    if (!cell) return;
    const row = cell.parentElement as HTMLTableRowElement;
    const tbody = row.parentElement as HTMLTableSectionElement;
    const newRow = document.createElement("tr");

    const cellCount = row.cells.length;
    for (let i = 0; i < cellCount; i++) {
      const newCell = document.createElement("td");
      newCell.className = "border border-border/70 p-2 min-h-[40px] focus:outline-none";
      newCell.innerHTML = "&nbsp;";
      newRow.appendChild(newCell);
    }

    tbody.insertBefore(newRow, row.nextSibling);
    handleEditorInput();
  };

  const insertColumnLeft = () => {
    const cell = activeCellRef.current;
    if (!cell) return;
    const cellIndex = cell.cellIndex;
    const row = cell.parentElement as HTMLTableRowElement;
    const table = row.closest("table") as HTMLTableElement;

    const rows = table.rows;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const newCell = document.createElement("td");
      newCell.className = "border border-border/70 p-2 min-h-[40px] focus:outline-none";
      newCell.innerHTML = "&nbsp;";
      r.insertBefore(newCell, r.cells[cellIndex]);
    }
    handleEditorInput();
  };

  const insertColumnRight = () => {
    const cell = activeCellRef.current;
    if (!cell) return;
    const cellIndex = cell.cellIndex;
    const row = cell.parentElement as HTMLTableRowElement;
    const table = row.closest("table") as HTMLTableElement;

    const rows = table.rows;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const newCell = document.createElement("td");
      newCell.className = "border border-border/70 p-2 min-h-[40px] focus:outline-none";
      newCell.innerHTML = "&nbsp;";
      r.insertBefore(newCell, r.cells[cellIndex + 1] || null);
    }
    handleEditorInput();
  };

  const deleteRow = () => {
    const cell = activeCellRef.current;
    if (!cell) return;
    const row = cell.parentElement as HTMLTableRowElement;
    const table = row.closest("table") as HTMLTableElement;

    if (table.rows.length <= 1) {
      table.remove();
      setIsInsideTable(false);
      activeCellRef.current = null;
    } else {
      row.remove();
    }
    handleEditorInput();
  };

  const deleteColumn = () => {
    const cell = activeCellRef.current;
    if (!cell) return;
    const cellIndex = cell.cellIndex;
    const row = cell.parentElement as HTMLTableRowElement;
    const table = row.closest("table") as HTMLTableElement;

    if (row.cells.length <= 1) {
      table.remove();
      setIsInsideTable(false);
      activeCellRef.current = null;
    } else {
      const rows = table.rows;
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (r.cells[cellIndex]) {
          r.cells[cellIndex].remove();
        }
      }
    }
    handleEditorInput();
  };

  const deleteTable = () => {
    const cell = activeCellRef.current;
    if (!cell) return;
    const table = cell.closest("table");
    if (table) {
      table.remove();
      setIsInsideTable(false);
      activeCellRef.current = null;
      handleEditorInput();
    }
  };

  const triggerImmediateSave = (newTitle: string, newClientId: string, newFolderId: string = editorFolderId) => {
    if (!currentNote || currentNote.permission_level !== "edit") return;
    setSaveStatus("saving");

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    void saveDocumentData(
      currentNote.id,
      newTitle,
      newClientId,
      newFolderId,
      editorRef.current?.innerHTML || "",
      currentNote.audio_url
    );
  };

  const handleApplyStyle = (command: string, value: string = "") => {
    if (typeof window !== "undefined") {
      restoreSelection();
      try {
        document.execCommand("styleWithCSS", false, "true");
      } catch (e) {
        console.error(e);
      }
      document.execCommand(command, false, value);
      if (editorRef.current) {
        editorRef.current.focus();
      }
      handleEditorInput();
      saveSelection();
    }
  };

  const handleApplyFontSize = (sizeValue: string) => {
    if (typeof window !== "undefined") {
      restoreSelection();
      try {
        const isKeyword = ["1", "2", "3", "4", "5", "6", "7"].includes(sizeValue);
        if (!isKeyword) {
          document.execCommand("styleWithCSS", false, "false");
          document.execCommand("fontSize", false, "7");

          if (editorRef.current) {
            const fontElements = Array.from(editorRef.current.querySelectorAll("font[size='7']"));
            fontElements.forEach(el => {
              const span = document.createElement("span");
              span.style.fontSize = `${sizeValue}px`;
              span.innerHTML = el.innerHTML;
              el.parentNode?.replaceChild(span, el);
            });
          }
        } else {
          document.execCommand("styleWithCSS", false, "false");
          document.execCommand("fontSize", false, sizeValue);
          document.execCommand("styleWithCSS", false, "true");
        }
      } catch (e) {
        console.error(e);
      }
      if (editorRef.current) {
        editorRef.current.focus();
      }
      handleEditorInput();
      saveSelection();
    }
  };

  const handleAddGoogleFont = (fontName: string) => {
    const formattedFont = fontName.trim();
    if (!formattedFont) return;

    if (SUPPORTED_FONTS.includes(formattedFont) || dynamicallyLoadedFonts.includes(formattedFont)) {
      toast.info(`"${formattedFont}" is already available in the fonts list.`);
      setSelectedFont(formattedFont);
      restoreSelection();
      handleApplyStyle("fontName", formattedFont);
      setIsMoreFontsOpen(false);
      return;
    }

    const toastId = toast.loading(`Loading font "${formattedFont}" from Google Fonts...`);
    try {
      const id = `google-font-${formattedFont.toLowerCase().replace(/\s+/g, '-')}`;
      let link = document.getElementById(id) as HTMLLinkElement | null;

      const onFontLoaded = () => {
        toast.success(`"${formattedFont}" added successfully!`, { id: toastId });
        setDynamicallyLoadedFonts(prev => [...prev, formattedFont]);
        setSelectedFont(formattedFont);

        if (!recentFonts.includes(formattedFont)) {
          setRecentFonts(prev => [formattedFont, ...prev].slice(0, 5));
        }

        restoreSelection();
        handleApplyStyle("fontName", formattedFont);
        setFontSearchQuery("");
        setIsMoreFontsOpen(false);
      };

      if (link) {
        onFontLoaded();
      } else {
        link = document.createElement("link");
        link.id = id;
        link.rel = "stylesheet";
        link.href = `https://fonts.googleapis.com/css2?family=${formattedFont.replace(/\s+/g, '+')}:wght@400;500;700&display=swap`;

        link.onload = () => {
          onFontLoaded();
        };

        link.onerror = () => {
          toast.error(`Could not load font "${formattedFont}". Make sure spelling is correct.`, { id: toastId });
          link?.remove();
        };

        document.head.appendChild(link);
      }
    } catch (err) {
      console.error(err);
      toast.error(`Failed to load font "${formattedFont}"`, { id: toastId });
    }
  };


  const handleUndo = () => {
    if (typeof window !== "undefined") {
      restoreSelection();
      document.execCommand("undo");
      if (editorRef.current) {
        editorRef.current.focus();
      }
      handleEditorInput();
      saveSelection();
    }
  };

  const handleRedo = () => {
    if (typeof window !== "undefined") {
      restoreSelection();
      document.execCommand("redo");
      if (editorRef.current) {
        editorRef.current.focus();
      }
      handleEditorInput();
      saveSelection();
    }
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const handleInsertLink = () => {
    if (typeof window !== "undefined") {
      saveSelection();
      const sel = window.getSelection();
      const selectedText = sel ? sel.toString().trim() : "";
      setLinkText(selectedText);
      setLinkUrl("");
      setIsLinkModalOpen(true);
    }
  };

  const handleInsertLinkSubmit = () => {
    if (typeof window !== "undefined") {
      restoreSelection();
      const url = linkUrl.trim();
      const text = linkText.trim();
      if (url) {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          const selectionText = range.toString().trim();

          if (selectionText !== text || !selectionText) {
            range.deleteContents();
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.target = "_blank";
            anchor.className = "text-primary underline hover:text-primary/80 transition-colors";
            anchor.innerText = text || url;
            range.insertNode(anchor);

            const newRange = document.createRange();
            newRange.setStartAfter(anchor);
            newRange.collapse(true);
            sel.removeAllRanges();
            sel.addRange(newRange);
          } else {
            document.execCommand("createLink", false, url);
            if (editorRef.current) {
              const links = Array.from(editorRef.current.querySelectorAll("a[href='" + url + "']"));
              links.forEach(a => {
                a.className = "text-primary underline hover:text-primary/80 transition-colors";
                a.setAttribute("target", "_blank");
              });
            }
          }
        } else {
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.target = "_blank";
          anchor.className = "text-primary underline hover:text-primary/80 transition-colors";
          anchor.innerText = text || url;
          editorRef.current?.appendChild(anchor);
        }

        if (editorRef.current) {
          editorRef.current.focus();
        }
        handleEditorInput();
        saveSelection();
      }
    }
    setIsLinkModalOpen(false);
    setLinkUrl("");
    setLinkText("");
  };

  const handleApplyHighlight = (color: string) => {
    if (typeof window !== "undefined") {
      restoreSelection();
      try {
        document.execCommand("styleWithCSS", false, "true");
        document.execCommand("backColor", false, color === "transparent" ? "rgba(0,0,0,0)" : color);
      } catch (e) {
        console.error(e);
      }
      if (editorRef.current) {
        editorRef.current.focus();
      }
      handleEditorInput();
      saveSelection();
    }
  };

  const handleIncreaseFontSize = () => {
    const sizes = ["8", "9", "10", "11", "12", "14", "18", "24", "30", "36", "48", "60", "72", "96"];
    const idx = sizes.indexOf(selectedFontSize);
    if (idx !== -1 && idx < sizes.length - 1) {
      const nextSize = sizes[idx + 1];
      setSelectedFontSize(nextSize);
      handleApplyFontSize(nextSize);
    } else if (idx === -1) {
      const currentSizeNum = parseInt(selectedFontSize) || 16;
      const nextSize = sizes.find(sz => parseInt(sz) > currentSizeNum) || "96";
      setSelectedFontSize(nextSize);
      handleApplyFontSize(nextSize);
    }
  };

  const handleDecreaseFontSize = () => {
    const sizes = ["8", "9", "10", "11", "12", "14", "18", "24", "30", "36", "48", "60", "72", "96"];
    const idx = sizes.indexOf(selectedFontSize);
    if (idx > 0) {
      const nextSize = sizes[idx - 1];
      setSelectedFontSize(nextSize);
      handleApplyFontSize(nextSize);
    } else if (idx === -1) {
      const currentSizeNum = parseInt(selectedFontSize) || 16;
      const nextSize = [...sizes].reverse().find(sz => parseInt(sz) < currentSizeNum) || "8";
      setSelectedFontSize(nextSize);
      handleApplyFontSize(nextSize);
    }
  };

  const handleLineSpacing = (spacing: string) => {
    if (typeof window === "undefined") return;
    restoreSelection();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !editorRef.current) return;
    const range = sel.getRangeAt(0);

    const elements = getSelectedBlockElements(editorRef.current, range);
    elements.forEach(element => {
      element.style.lineHeight = spacing;
    });

    setSelectedLineSpacing(spacing);
    if (editorRef.current) {
      editorRef.current.focus();
    }
    handleEditorInput();
    saveSelection();
  };

  const handleParagraphSpace = (type: "before" | "after" | "remove") => {
    if (typeof window === "undefined") return;
    restoreSelection();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !editorRef.current) return;
    const range = sel.getRangeAt(0);

    const elements = getSelectedBlockElements(editorRef.current, range);
    elements.forEach(element => {
      const isLi = element.tagName.toUpperCase() === "LI";
      if (type === "before") {
        if (isLi) {
          element.style.marginTop = element.style.marginTop === "16px" ? "" : "16px";
          element.style.paddingTop = "";
        } else {
          element.style.paddingTop = element.style.paddingTop === "16px" ? "" : "16px";
          element.style.marginTop = "";
        }
      } else if (type === "after") {
        if (isLi) {
          element.style.marginBottom = element.style.marginBottom === "16px" ? "" : "16px";
          element.style.paddingBottom = "";
        } else {
          element.style.paddingBottom = element.style.paddingBottom === "16px" ? "" : "16px";
          element.style.marginBottom = "";
        }
      } else {
        element.style.marginTop = "";
        element.style.marginBottom = "";
        element.style.paddingTop = "";
        element.style.paddingBottom = "";
      }
    });

    if (elements.length > 0) {
      const firstEl = elements[0];
      const isLi = firstEl.tagName.toUpperCase() === "LI";
      if (isLi) {
        setHasSpaceBefore(firstEl.style.marginTop === "16px");
        setHasSpaceAfter(firstEl.style.marginBottom === "16px");
      } else {
        setHasSpaceBefore(firstEl.style.paddingTop === "16px");
        setHasSpaceAfter(firstEl.style.paddingBottom === "16px");
      }
    }

    if (editorRef.current) {
      editorRef.current.focus();
    }
    handleEditorInput();
    saveSelection();
  };

  const handleApplyCustomSpacing = (lineSpacing: string, spaceBefore: string, spaceAfter: string) => {
    if (typeof window === "undefined") return;
    restoreSelection();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !editorRef.current) return;
    const range = sel.getRangeAt(0);

    const elements = getSelectedBlockElements(editorRef.current, range);
    elements.forEach(element => {
      if (lineSpacing) element.style.lineHeight = lineSpacing;
      const isLi = element.tagName.toUpperCase() === "LI";
      if (spaceBefore) {
        if (isLi) {
          element.style.marginTop = `${spaceBefore}px`;
          element.style.paddingTop = "";
        } else {
          element.style.paddingTop = `${spaceBefore}px`;
          element.style.marginTop = "";
        }
      }
      if (spaceAfter) {
        if (isLi) {
          element.style.marginBottom = `${spaceAfter}px`;
          element.style.paddingBottom = "";
        } else {
          element.style.paddingBottom = `${spaceAfter}px`;
          element.style.marginBottom = "";
        }
      }
    });

    if (editorRef.current) {
      editorRef.current.focus();
    }
    handleEditorInput();
    saveSelection();
  };

  const handleCustomColorChange = (e: React.ChangeEvent<HTMLInputElement>, type: "text" | "highlight") => {
    const color = e.target.value;
    if (!color) return;
    restoreSelection();
    if (!customColors.includes(color)) {
      setCustomColors(prev => [color, ...prev].slice(0, 10));
    }
    if (type === "text") {
      setSelectedColor(color);
      handleApplyStyle("foreColor", color);
      setIsTextColorOpen(false);
    } else {
      setSelectedHighlightColor(color);
      handleApplyHighlight(color);
      setIsHighlightColorOpen(false);
    }
  };

  const handleInsertTaskList = () => {
    if (typeof window === "undefined") return;
    restoreSelection();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !editorRef.current) return;
    const range = sel.getRangeAt(0);
    let parent = range.commonAncestorContainer;
    while (parent && parent !== editorRef.current) {
      if (parent.nodeType === Node.ELEMENT_NODE && (parent as HTMLElement).tagName === "DIV" && (parent as HTMLElement).classList.contains("editor-content")) {
        break;
      }
      if (parent.nodeType === Node.ELEMENT_NODE && ["P", "DIV", "H1", "H2", "H3"].includes((parent as HTMLElement).tagName)) {
        break;
      }
      parent = parent.parentNode || editorRef.current;
    }
    if (!parent || parent === editorRef.current) {
      const anchor = sel.anchorNode;
      let anchorParent = anchor?.nodeType === Node.ELEMENT_NODE ? (anchor as HTMLElement) : anchor?.parentElement;
      while (anchorParent && anchorParent.parentElement !== editorRef.current && anchorParent !== editorRef.current) {
        anchorParent = anchorParent.parentElement;
      }
      parent = anchorParent || editorRef.current;
    }

    const ul = document.createElement("ul");
    ul.setAttribute("data-type", "taskList");
    ul.className = "list-none pl-0 my-2";

    const li = document.createElement("li");
    li.setAttribute("data-type", "taskItem");
    li.className = "flex items-start mb-1";

    const label = document.createElement("label");
    label.setAttribute("contenteditable", "false");
    label.className = "select-none mr-2 mt-1 shrink-0 cursor-pointer";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.className = "task-checkbox";

    const span = document.createElement("span");

    label.appendChild(input);
    label.appendChild(span);

    const contentDiv = document.createElement("div");
    contentDiv.className = "task-content outline-none inline-block min-w-[20px] flex-1";
    contentDiv.innerHTML = "<br>";

    li.appendChild(label);
    li.appendChild(contentDiv);
    ul.appendChild(li);

    if (parent && parent !== editorRef.current) {
      parent.parentNode?.replaceChild(ul, parent);
    } else {
      editorRef.current.appendChild(ul);
    }

    contentDiv.focus();
    const newRange = document.createRange();
    newRange.setStart(contentDiv, 0);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);
    handleEditorInput();
  };

  const handleOpenSharing = () => {
    if (!currentNote) return;

    const initialMap: Record<string, { selected: boolean; level: "view" | "edit" }> = {};
    activeStaff.forEach(s => {
      initialMap[s.id] = { selected: false, level: "view" };
    });

    currentNote.shared_with.forEach(s => {
      initialMap[s.staff_id] = { selected: true, level: s.permission_level };
    });

    setSharingMap(initialMap);
    setShareOpen(true);
  };

  const handleOpenFolderSharing = (folder: NoteFolder) => {
    setActiveFolderToShare(folder);

    const initialMap: Record<string, { selected: boolean; level: "view" | "edit" }> = {};
    activeStaff.forEach(s => {
      initialMap[s.id] = { selected: false, level: "view" };
    });

    (folder.shared_with || []).forEach(s => {
      initialMap[s.staff_id] = { selected: true, level: s.permission_level };
    });

    setSharingFolderMap(initialMap);
    setShareFolderOpen(true);
  };

  const handleFolderShareCheck = (staffId: string, checked: boolean) => {
    setSharingFolderMap(prev => ({
      ...prev,
      [staffId]: {
        ...prev[staffId],
        selected: checked
      }
    }));
  };

  const handleFolderShareLevelChange = (staffId: string, level: "view" | "edit") => {
    setSharingFolderMap(prev => ({
      ...prev,
      [staffId]: {
        ...prev[staffId],
        level
      }
    }));
  };

  const handleSaveFolderSharing = async () => {
    if (!activeFolderToShare) return;
    setShareFolderSubmitting(true);
    try {
      const shared_staff = Object.entries(sharingFolderMap)
        .filter(([_, val]) => val.selected)
        .map(([staffId, val]) => ({
          staff_id: staffId,
          permission_level: val.level
        }));

      const res = await fetchWithAuth("/api/notes/folders", {
        method: "PUT",
        body: JSON.stringify({
          id: activeFolderToShare.id,
          name: activeFolderToShare.name,
          shared_staff: shared_staff
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update folder sharing access");
      }

      toast.success("Folder sharing access updated successfully");
      setShareFolderOpen(false);
      void loadNoteFolders();
      void loadNotes();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to save folder sharing configurations");
    } finally {
      setShareFolderSubmitting(false);
    }
  };

  const handleShareCheck = (staffId: string, checked: boolean) => {
    setSharingMap(prev => ({
      ...prev,
      [staffId]: {
        ...prev[staffId],
        selected: checked
      }
    }));
  };

  const handleShareLevelChange = (staffId: string, level: "view" | "edit") => {
    setSharingMap(prev => ({
      ...prev,
      [staffId]: {
        ...prev[staffId],
        level
      }
    }));
  };

  const handleSaveSharing = async () => {
    if (!currentNote) return;
    setShareSubmitting(true);
    try {
      const shared_staff = Object.entries(sharingMap)
        .filter(([_, val]) => val.selected)
        .map(([staffId, val]) => ({
          staff_id: staffId,
          permission_level: val.level
        }));

      const res = await fetchWithAuth("/api/notes", {
        method: "PUT",
        body: JSON.stringify({
          id: currentNote.id,
          title: editorTitle.trim(),
          content: editorRef.current?.innerHTML || "",
          client_id: editorClientId || null,
          folder_id: editorFolderId || null,
          shared_staff: shared_staff
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update sharing access");
      }

      toast.success("Document sharing access updated successfully");

      const updatedShares = shared_staff.map(s => {
        const p = activeStaff.find(prof => prof.id === s.staff_id);
        return {
          staff_id: s.staff_id,
          full_name: p?.full_name || "Unknown Staff",
          permission_level: s.permission_level as "view" | "edit"
        };
      });

      setCurrentNote(prev => prev ? { ...prev, shared_with: updatedShares } : null);
      setShareOpen(false);
      void loadNotes();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to save sharing configurations");
    } finally {
      setShareSubmitting(false);
    }
  };

  const pinnedFolders = useMemo(() => {
    return folders.filter(f => f.is_pinned || f.is_favorite);
  }, [folders]);

  const pinnedNotes = useMemo(() => {
    return notes.filter(n => n.is_pinned || n.is_favorite);
  }, [notes]);

  // Filter custom folders list for main dashboard view based on clientFilter selection, parent_id, and search query
  const filteredFolders = useMemo(() => {
    return folders.filter(f => {
      if (searchQuery.trim()) {
        const matchesQuery = f.name.toLowerCase().includes(searchQuery.toLowerCase());
        const associatedClient = f.client_id ? clients.find(cl => cl.id === f.client_id) : null;
        const matchesClientName = associatedClient ? associatedClient.company_name.toLowerCase().includes(searchQuery.toLowerCase()) : false;
        return matchesQuery || matchesClientName;
      }
      if ((f.parent_id ?? null) !== (activeFolderId || null)) return false;
      if (!activeFolderId) {
        if (clientFilter === "internal") return f.client_id === null;
        if (clientFilter !== "all" && f.client_id !== clientFilter) return false;
      }
      return true;
    });
  }, [folders, clientFilter, searchQuery, activeFolderId, clients]);

  // Slice folders to display a maximum of 3 rows (12 items on desktop, 6 items on mobile) by default
  const visibleFolders = useMemo(() => {
    const limit = isMobile ? 6 : 12;
    return isFoldersExpanded ? filteredFolders : filteredFolders.slice(0, limit);
  }, [filteredFolders, isFoldersExpanded, isMobile]);

  // Memoized map of folder ID to its full path string
  const folderPathNames = useMemo(() => {
    const names: Record<string, string> = {};
    folders.forEach(f => {
      const path: string[] = [];
      let current: NoteFolder | undefined = f;
      while (current) {
        path.unshift(current.name);
        const pid: string | null | undefined = current.parent_id;
        current = pid ? folders.find(parent => parent.id === pid) : undefined;
      }
      names[f.id] = path.join(" > ");
    });
    return names;
  }, [folders]);

  // Options for move destination (excluding descendant folders to prevent circular moves)
  const moveFolderOptions = useMemo(() => {
    if (moveItemType === "note") {
      return folders;
    }
    const descendants = new Set<string>();
    const getDescendants = (parentId: string) => {
      folders.forEach(f => {
        if (f.parent_id === parentId) {
          descendants.add(f.id);
          getDescendants(f.id);
        }
      });
    };
    if (moveItemId) {
      descendants.add(moveItemId);
      getDescendants(moveItemId);
    }
    return folders.filter(f => !descendants.has(f.id));
  }, [folders, moveItemId, moveItemType]);

  // Path array for breadcrumb rendering
  const folderPath = useMemo(() => {
    if (!activeFolderId) return [];
    const path: NoteFolder[] = [];
    let current = folders.find(f => f.id === activeFolderId);
    while (current) {
      path.unshift(current);
      const parentId = current.parent_id;
      current = parentId ? folders.find(f => f.id === parentId) : undefined;
    }
    return path;
  }, [activeFolderId, folders]);

  // Stretch parent container to full-screen when editor is active
  useEffect(() => {
    const parent = document.querySelector("main > div");
    if (!parent) return;

    if (currentNote) {
      parent.classList.remove("max-w-[1600px]");
      parent.classList.add("max-w-none");
    } else {
      parent.classList.remove("max-w-none");
      parent.classList.add("max-w-[1600px]");
    }

    return () => {
      parent.classList.remove("max-w-none");
      parent.classList.add("max-w-[1600px]");
    };
  }, [currentNote]);

  // Breadcrumbs element renderer
  const renderBreadcrumbs = () => {
    return (
      <div className="flex items-center flex-wrap gap-1 text-xs text-muted-foreground py-1 select-none">
        <span
          onClick={() => setActiveFolderId(null)}
          className="hover:text-primary cursor-pointer transition-colors font-semibold flex items-center gap-1.5"
        >
          <HardDrive className="h-3.5 w-3.5" /> Notes (Root)
        </span>
        {folderPath.map((folder, index) => {
          const isLast = index === folderPath.length - 1;
          const associatedClient = folder.client_id ? clients.find(c => c.id === folder.client_id) : null;
          return (
            <React.Fragment key={folder.id}>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
              <span
                onClick={() => !isLast && setActiveFolderId(folder.id)}
                className={cn(
                  "transition-colors font-medium truncate max-w-[150px] font-sans",
                  isLast
                    ? "text-foreground font-semibold"
                    : "hover:text-primary cursor-pointer"
                )}
                title={associatedClient ? `${folder.name} (${associatedClient.company_name})` : folder.name}
              >
                {folder.name} {associatedClient && `(${associatedClient.company_name})`}
              </span>
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  // Filter notes based on active custom folder, client filter, search query, and scope
  const filteredNotes = useMemo(() => {
    return notes.filter(n => {
      // Global search filters out folder groupings
      if (searchQuery.trim() && !n.title.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      if (!searchQuery.trim()) {
        // 1. If currently inside a custom folder
        if (activeFolderId !== null) {
          if (n.folder_id !== activeFolderId) return false;
        } else {
          // If in main dashboard view, only show folder-less (root) notes
          if (n.folder_id !== null) return false;
        }
      }

      // Always apply client filter if selected and activeFolderId is null
      if (activeFolderId === null && clientFilter !== "all") {
        if (clientFilter === "internal") {
          if (n.client_id !== null) return false;
        } else {
          if (n.client_id !== clientFilter) return false;
        }
      }

      if (scopeFilter === "mine" && n.created_by !== profile?.id) {
        return false;
      }
      if (scopeFilter === "shared" && n.created_by === profile?.id) {
        return false;
      }
      return true;
    });
  }, [notes, searchQuery, activeFolderId, clientFilter, scopeFilter, profile]);

  const getSubFolderNoteCount = (subFolderId: string) => {
    return notes.filter(n => n.folder_id === subFolderId).length;
  };

  const activeFolderName = useMemo(() => {
    if (!activeFolderId) return "";
    const f = folders.find(folder => folder.id === activeFolderId);
    if (!f) return "Folder";

    // Find client name if folder is associated
    if (f.client_id) {
      const c = clients.find(client => client.id === f.client_id);
      return `${f.name} (${c?.company_name || "Client"})`;
    }
    return `${f.name} (Internal)`;
  }, [activeFolderId, folders, clients]);

  // Custom folder options for document creation based on selected client
  const creationFoldersOptions = useMemo(() => {
    const targetClientId = createClientId === "none" ? null : createClientId;
    return folders.filter(f => f.client_id === targetClientId);
  }, [folders, createClientId]);

  // Editor subfolder selection options
  const editorFoldersOptions = useMemo(() => {
    const targetClientId = editorClientId === "none" ? null : editorClientId;
    return folders.filter(f => f.client_id === targetClientId);
  }, [folders, editorClientId]);

  return (
    <div className={cn("space-y-6", currentNote && "space-y-0")}>
      {/* Editor CSS styles block: Custom typography styles */}
      <style dangerouslySetInnerHTML={{
        __html: `
        .editor-content { font-family: 'Inter', sans-serif; line-height: 1.6; letter-spacing: normal; }
        .editor-content ::selection { background-color: rgba(59, 130, 246, 0.2); }
        .editor-content h1 { font-size: 2.25rem; font-weight: 800; margin-top: 1.5rem; margin-bottom: 0.75rem; line-height: 1.2; color: inherit; }
        .editor-content h2 { font-size: 1.75rem; font-weight: 700; margin-top: 1.25rem; margin-bottom: 0.5rem; color: inherit; }
        .editor-content h3 { font-size: 1.35rem; font-weight: 600; margin-top: 1rem; margin-bottom: 0.25rem; color: inherit; }
        .editor-content p { margin-top: 0px; margin-bottom: 16px; line-height: 1.6; color: inherit; }
        .editor-content ul { list-style-type: disc; padding-left: 1.75rem; margin-top: 0px; margin-bottom: 16px; }
        .editor-content ol { list-style-type: decimal; padding-left: 1.75rem; margin-top: 0px; margin-bottom: 16px; }
        .editor-content li { margin-bottom: 4px; }
        .editor-content blockquote { border-left: 4px solid #a78bfa; padding-left: 1.25rem; font-style: italic; color: #71717a; margin: 1.25rem 0; }
        .editor-content a { color: #4f46e5; text-decoration: underline; cursor: pointer; }

        /* Font-face mapping to override Tailwind's global inherit reset */
        .editor-content font[face="Inter"] { font-family: 'Inter', sans-serif !important; }
        .editor-content font[face="Roboto"] { font-family: 'Roboto', sans-serif !important; }
        .editor-content font[face="Outfit"] { font-family: 'Outfit', sans-serif !important; }
        .editor-content font[face="Playfair Display"] { font-family: 'Playfair Display', serif !important; }
        .editor-content font[face="Lora"] { font-family: 'Lora', serif !important; }
        .editor-content font[face="Poppins"] { font-family: 'Poppins', sans-serif !important; }
        .editor-content font[face="Montserrat"] { font-family: 'Montserrat', sans-serif !important; }
        .editor-content font[face="Nunito"] { font-family: 'Nunito', sans-serif !important; }
        .editor-content font[face="Open Sans"] { font-family: 'Open Sans', sans-serif !important; }
        .editor-content font[face="Lato"] { font-family: 'Lato', sans-serif !important; }
        .editor-content font[face="Oswald"] { font-family: 'Oswald', sans-serif !important; }
        .editor-content font[face="Merriweather"] { font-family: 'Merriweather', serif !important; }
        .editor-content font[face="Josefin Sans"] { font-family: 'Josefin Sans', sans-serif !important; }
        .editor-content font[face="Ubuntu"] { font-family: 'Ubuntu', sans-serif !important; }
        .editor-content font[face="Cinzel"] { font-family: 'Cinzel', serif !important; }
        .editor-content font[face="Fira Code"] { font-family: 'Fira Code', monospace !important; }
        .editor-content font[face="Source Code Pro"] { font-family: 'Source Code Pro', monospace !important; }
        .editor-content font[face="Pacifico"] { font-family: 'Pacifico', cursive !important; }
        .editor-content font[face="Dancing Script"] { font-family: 'Dancing Script', cursive !important; }

        /* Bengali Font Mappings */
        .editor-content font[face="Hind Siliguri"] { font-family: 'Hind Siliguri', sans-serif !important; }
        .editor-content font[face="Baloo Da 2"] { font-family: 'Baloo Da 2', cursive !important; }
        .editor-content font[face="Anek Bangla"] { font-family: 'Anek Bangla', sans-serif !important; }
        .editor-content font[face="Noto Sans Bengali"] { font-family: 'Noto Sans Bengali', sans-serif !important; }
        .editor-content font[face="Noto Serif Bengali"] { font-family: 'Noto Serif Bengali', serif !important; }

        /* Font-size mapping for editor size selections */
        .editor-content font[size="1"] { font-size: 12px !important; }
        .editor-content font[size="2"] { font-size: 14px !important; }
        .editor-content font[size="3"] { font-size: 16px !important; }
        .editor-content font[size="4"] { font-size: 18px !important; }
        .editor-content font[size="5"] { font-size: 24px !important; }
        .editor-content font[size="6"] { font-size: 32px !important; }
        .editor-content font[size="7"] { font-size: 48px !important; }

        /* Dynamic Table Styling */
        .editor-content table { 
          width: 100%; 
          border-collapse: collapse; 
          margin: 1.5rem 0; 
          table-layout: fixed; 
          border: 1px solid #e2e8f0; 
          border-radius: 0.75rem; 
          overflow: hidden; 
        }
        .dark .editor-content table {
          border-color: #334155;
        }
        .editor-content th, .editor-content td { 
          border: 1px solid #e2e8f0; 
          padding: 0.75rem; 
          min-height: 44px; 
          text-align: left; 
          vertical-align: top;
          outline: none;
        }
        .dark .editor-content th, .dark .editor-content td {
          border-color: #334155;
        }
        .editor-content th { 
          background-color: #f8fafc; 
          font-weight: 600; 
        }
        .dark .editor-content th {
          background-color: #1e293b;
        }
        .editor-content td:focus-visible, .editor-content th:focus-visible {
          background-color: rgba(59, 130, 246, 0.03);
          box-shadow: inset 0 0 0 1px #3b82f6;
        }
      ` }} />

      {!currentNote ? (
        // DASHBOARD VIEW
        <>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-indigo-500 bg-clip-text text-transparent">Notes</h1>
              <p className="text-muted-foreground text-sm">
                Create secure document folders client-wise and collaborate on rich-text specification files.
              </p>
            </div>
            <div className="flex items-center gap-2 select-none">
              {!searchQuery.trim() && (
                <Button
                  onClick={() => {
                    const parentIdVal = activeFolderId || "none";
                    setNewFolderParentId(parentIdVal);
                    if (activeFolderId) {
                      const activeFolder = folders.find(f => f.id === activeFolderId);
                      setNewFolderClientId(activeFolder?.client_id || "none");
                    } else {
                      setNewFolderClientId(clientFilter !== "all" && clientFilter !== "internal" ? clientFilter : "none");
                    }
                    setCreateFolderOpen(true);
                  }}
                  variant="outline"
                  className="rounded-xl gap-2 cursor-pointer shrink-0 border-border/60 hover:bg-muted/50"
                >
                  <FolderPlus className="h-4.5 w-4.5" /> New Folder
                </Button>
              )}
              <Button
                onClick={() => {
                  setCreateClientId(clientFilter !== "all" && clientFilter !== "internal" ? clientFilter : "none");
                  setCreateFolderId(activeFolderId || "none");
                  setCreateOpen(true);
                }}
                className="gradient-primary shadow-elegant rounded-xl gap-2 cursor-pointer shrink-0"
              >
                <Plus className="h-5 w-5" /> New Document
              </Button>
            </div>
          </div>

          {/* Search and Filters section */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center bg-muted/40 dark:bg-muted/10 p-2 rounded-2xl">
            <div className="flex items-center gap-2 flex-1 w-full">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search notes globally by title..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 bg-background border border-border/80 shadow-none rounded-xl h-10 focus-visible:ring-1 focus-visible:ring-primary/20 w-full"
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowFiltersMobile(!showFiltersMobile)}
                className={cn(
                  "md:hidden h-10 w-10 shrink-0 rounded-xl cursor-pointer border border-border/80 bg-background hover:bg-muted/50",
                  showFiltersMobile && "bg-primary/10 text-primary border-primary/30"
                )}
                title="Toggle Filters"
              >
                <SlidersHorizontal className="h-4.5 w-4.5" />
              </Button>
            </div>
            <div
              className={cn(
                "flex-wrap items-center gap-3 w-full md:w-auto",
                showFiltersMobile ? "flex" : "hidden",
                "md:flex"
              )}
            >
              {/* Client Filter Dropdown */}
              {activeFolderId === null && (
                <Select value={clientFilter} onValueChange={setClientFilter}>
                  <SelectTrigger className="w-full md:w-[240px] bg-background border border-border/80 rounded-xl cursor-pointer shadow-none h-10">
                    <SelectValue placeholder="All Clients" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="cursor-pointer">All Clients / Categories</SelectItem>
                    <SelectItem value="internal" className="cursor-pointer">Internal & Personal</SelectItem>
                    {clients.map(c => (
                      <SelectItem key={c.id} value={c.id} className="cursor-pointer">
                        {c.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Select value={scopeFilter} onValueChange={v => setScopeFilter(v as any)}>
                <SelectTrigger className="w-full md:w-[200px] bg-background border border-border/80 rounded-xl cursor-pointer shadow-none h-10">
                  <SelectValue placeholder="Scope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Shared / Owned</SelectItem>
                  <SelectItem value="mine">My Notes</SelectItem>
                  <SelectItem value="shared">Shared with me</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="icon"
                onClick={handleRefreshAll}
                disabled={loading}
                className="h-10 w-10 shrink-0 rounded-xl cursor-pointer border border-border/80 bg-background hover:bg-muted/50 text-foreground"
                title="Refresh notes list"
              >
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              </Button>
            </div>
          </div>

          {/* Breadcrumb for sub-folder view */}
          {activeFolderId !== null && !searchQuery.trim() && (
            <div className="flex items-center justify-between gap-4 p-2 bg-muted/20 rounded-xl select-none mb-4">
              {renderBreadcrumbs()}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveFolderId(null)}
                className="h-7 text-xs rounded-lg text-primary hover:bg-primary/5 cursor-pointer font-medium shrink-0"
              >
                <ArrowLeft className="h-3 w-3 mr-1" /> Back to Root
              </Button>
            </div>
          )}

          {/* LOADING AND MAIN GRIDS */}
          {loading ? (
            <CardGridSkeleton />
          ) : searchQuery.trim() ? (
            // Search Mode: Matching Folders + Matching Documents
            <div className="space-y-8">
              {/* Folders Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-muted-foreground/80 uppercase tracking-wider">Folders ({filteredFolders.length})</h2>
                  {filteredFolders.length > (isMobile ? 6 : 12) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsFoldersExpanded(!isFoldersExpanded)}
                      className="h-7 text-xs font-semibold text-primary hover:bg-primary/5 rounded-lg cursor-pointer"
                    >
                      {isFoldersExpanded ? "Show Less" : "View All"}
                    </Button>
                  )}
                </div>
                {filteredFolders.length === 0 ? (
                  <div className="text-xs text-muted-foreground italic py-3 bg-muted/10 rounded-xl px-4 border border-dashed border-border/40">
                    No folders match your search query.
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {visibleFolders.map(sf => {
                      const associatedClient = sf.client_id ? clients.find(cl => cl.id === sf.client_id) : null;
                      return (
                        <Card
                          key={sf.id}
                          className="group relative flex items-center justify-between p-3 rounded-xl border border-border/60 hover:border-primary/40 bg-card hover:bg-muted/10 transition-all duration-200 !shadow-none overflow-hidden"
                        >
                          <div
                            onClick={() => {
                              setSearchQuery("");
                              setActiveFolderId(sf.id);
                            }}
                            className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                          >
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                              <Folder className="h-4.5 w-4.5" />
                            </div>
                            <div className="flex flex-col min-w-0 pr-8">
                              <span className="font-semibold text-sm truncate group-hover:text-primary transition-colors flex items-center gap-1.5">
                                <span className="truncate">{sf.name}</span>
                                {sf.is_favorite && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 shrink-0" />}
                                {sf.is_pinned && <Pin className="h-3 w-3 text-primary fill-primary shrink-0" />}
                              </span>
                              <span className="text-[10px] text-muted-foreground font-medium truncate">
                                {associatedClient ? associatedClient.company_name : "Personal / Internal"} • {getSubFolderNoteCount(sf.id)} notes
                              </span>
                            </div>
                          </div>

                          {/* Desktop controls */}
                          <div className="hidden md:flex items-center gap-0.5 absolute right-2 top-1/2 -translate-y-1/2 bg-card/95 dark:bg-card/95 border border-border/40 pl-2 pr-1 py-1 rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all duration-200 shadow-lg z-10">
                            {/* Pin / Star Quick Toggles */}
                            <Button
                              size="icon"
                              variant="ghost"
                              className={cn(
                                "h-7 w-7 rounded-lg hover:bg-muted cursor-pointer text-muted-foreground/60 hover:text-yellow-500"
                              )}
                              onClick={() => handleToggleFolderFavorite(sf)}
                              title={sf.is_favorite ? "Remove from Favorites" : "Add to Favorites"}
                            >
                              <Star className={cn("h-3.5 w-3.5", sf.is_favorite && "fill-yellow-500 text-yellow-500")} />
                            </Button>

                            <Button
                              size="icon"
                              variant="ghost"
                              className={cn(
                                "h-7 w-7 rounded-lg hover:bg-muted cursor-pointer text-muted-foreground/60 hover:text-primary"
                              )}
                              onClick={() => handleToggleFolderPin(sf)}
                              title={sf.is_pinned ? "Unpin Folder" : "Pin Folder to Top"}
                            >
                              <Pin className={cn("h-3.5 w-3.5", sf.is_pinned && "fill-primary text-primary")} />
                            </Button>

                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 rounded-lg hover:bg-muted cursor-pointer text-muted-foreground/80 hover:text-foreground"
                              onClick={() => handleOpenFolderSharing(sf)}
                              title="Share Folder"
                            >
                              <Share2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 rounded-lg hover:bg-muted cursor-pointer text-muted-foreground/80 hover:text-foreground"
                              onClick={() => handleOpenMoveFolder(sf.id, sf.parent_id || null)}
                              title="Move Folder"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 rounded-lg hover:bg-muted cursor-pointer"
                              onClick={() => {
                                setRenameFolderId(sf.id);
                                setRenameFolderName(sf.name);
                                setRenameFolderOpen(true);
                              }}
                              title="Rename Folder"
                            >
                              <Edit className="h-3.5 w-3.5 text-muted-foreground/80 hover:text-foreground" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                              onClick={() => handleDeleteFolder(sf.id, sf.name)}
                              title="Delete Folder"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>

                          {/* Mobile controls */}
                          <div className="md:hidden flex items-center shrink-0">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 rounded-lg hover:bg-muted cursor-pointer text-muted-foreground/80 hover:text-foreground"
                                  title="Actions"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-[160px] rounded-xl p-1 shadow-lg bg-card border border-border/60 z-30">
                                <DropdownMenuItem
                                  onClick={() => handleToggleFolderPin(sf)}
                                  className="text-xs cursor-pointer rounded-lg focus:bg-muted/80 flex items-center gap-2"
                                >
                                  <Pin className="h-3.5 w-3.5" /> {sf.is_pinned ? "Unpin Folder" : "Pin Folder"}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleToggleFolderFavorite(sf)}
                                  className="text-xs cursor-pointer rounded-lg focus:bg-muted/80 flex items-center gap-2"
                                >
                                  <Star className="h-3.5 w-3.5" /> {sf.is_favorite ? "Unfavorite Folder" : "Favorite Folder"}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="my-1 border-t border-border/40" />
                                <DropdownMenuItem
                                  onClick={() => handleOpenFolderSharing(sf)}
                                  className="text-xs cursor-pointer rounded-lg focus:bg-muted/80 flex items-center gap-2"
                                >
                                  <Share2 className="h-3.5 w-3.5" /> Share Folder
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleOpenMoveFolder(sf.id, sf.parent_id || null)}
                                  className="text-xs cursor-pointer rounded-lg focus:bg-muted/80 flex items-center gap-2"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" /> Move Folder
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setRenameFolderId(sf.id);
                                    setRenameFolderName(sf.name);
                                    setRenameFolderOpen(true);
                                  }}
                                  className="text-xs cursor-pointer rounded-lg focus:bg-muted/80 flex items-center gap-2"
                                >
                                  <Edit className="h-3.5 w-3.5" /> Rename Folder
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="my-1 border-t border-border/40" />
                                <DropdownMenuItem
                                  onClick={() => handleDeleteFolder(sf.id, sf.name)}
                                  className="text-xs text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer rounded-lg flex items-center gap-2 font-semibold"
                                >
                                  <Trash2 className="h-3.5 w-3.5" /> Delete Folder
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Documents Section */}
              <div className="space-y-3">
                <h2 className="text-sm font-bold text-muted-foreground/80 uppercase tracking-wider">Documents ({filteredNotes.length})</h2>
                {filteredNotes.length === 0 ? (
                  <Card className="border border-border/80 bg-muted/5 rounded-3xl py-12 flex flex-col items-center justify-center text-center">
                    <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center mb-3 text-muted-foreground/60">
                      <FileText className="h-5 w-5" />
                    </div>
                    <h3 className="font-semibold text-sm">No matching documents found</h3>
                    <p className="text-muted-foreground text-xs mt-1">
                      No documents match your search query.
                    </p>
                  </Card>
                ) : (
                  <>
                    <NotesGrid notesList={filteredNotes.slice(0, visibleNotesCount)} handleOpenEditor={handleOpenEditor} handleDeleteDocument={handleDeleteDocument} isAdmin={isAdmin} activeStaff={activeStaff} profileId={profile?.id} foldersList={folders} onMoveNote={handleOpenMoveNote} onTogglePin={handleToggleNotePin} onToggleFavorite={handleToggleNoteFavorite} />
                    {filteredNotes.length > visibleNotesCount && (
                      <div className="flex justify-center pt-4">
                        <Button
                          onClick={() => setVisibleNotesCount(prev => prev + 21)}
                          variant="outline"
                          className="rounded-xl border-border/60 hover:bg-muted/50 font-semibold gap-1.5 px-6 cursor-pointer"
                        >
                          <RefreshCw className="h-4 w-4 text-muted-foreground animate-spin-hover" /> Load More Documents
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : activeFolderId === null ? (
            // Dashboard Mode: Custom Folders + Folder-less Notes
            <div className="space-y-8">
              {/* Pinned & Favorites Section */}
              {(pinnedFolders.length > 0 || pinnedNotes.length > 0) && (
                <Card className="bg-card/45 border-border/50 shadow-sm p-4 md:p-6 space-y-6 rounded-2xl">
                  <div className="flex items-center gap-2">
                    <Star className="h-4.5 w-4.5 text-yellow-500 fill-yellow-500" />
                    <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Favorites & Pinned</h2>
                  </div>

                  <div className="space-y-6">
                    {/* Pinned Folders Grid */}
                    {pinnedFolders.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Folders</h3>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          {pinnedFolders.map(sf => {
                            const associatedClient = sf.client_id ? clients.find(cl => cl.id === sf.client_id) : null;
                            return (
                              <Card
                                key={sf.id}
                                className="group relative flex items-center justify-between p-3 rounded-xl bg-card/65 border border-border/50 hover:shadow-md transition-all duration-200 overflow-hidden"
                              >
                                <div
                                  onClick={() => setActiveFolderId(sf.id)}
                                  className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                                >
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                                    <Folder className="h-4.5 w-4.5" />
                                  </div>
                                  <div className="flex flex-col min-w-0 pr-8">
                                    <span className="font-semibold text-sm truncate group-hover:text-primary transition-colors flex items-center gap-1.5">
                                      <span className="truncate">{sf.name}</span>
                                      {sf.is_favorite && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 shrink-0" />}
                                      {sf.is_pinned && <Pin className="h-3 w-3 text-primary fill-primary shrink-0" />}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground font-medium truncate">
                                      {associatedClient ? associatedClient.company_name : "Personal / Internal"} • {getSubFolderNoteCount(sf.id)} notes
                                    </span>
                                  </div>
                                </div>

                                <div className="hidden md:flex items-center gap-0.5 absolute right-2 top-1/2 -translate-y-1/2 bg-card/95 dark:bg-card/95 border border-border/40 pl-2 pr-1 py-1 rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all duration-200 shadow-lg z-10">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 rounded-lg hover:bg-muted cursor-pointer text-yellow-500"
                                    onClick={() => handleToggleFolderFavorite(sf)}
                                    title={sf.is_favorite ? "Remove from Favorites" : "Add to Favorites"}
                                  >
                                    <Star className={cn("h-3.5 w-3.5", sf.is_favorite && "fill-yellow-500 text-yellow-500")} />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className={cn(
                                      "h-7 w-7 rounded-lg hover:bg-muted cursor-pointer text-primary"
                                    )}
                                    onClick={() => handleToggleFolderPin(sf)}
                                    title={sf.is_pinned ? "Unpin Folder" : "Pin Folder to Top"}
                                  >
                                    <Pin className={cn("h-3.5 w-3.5", sf.is_pinned && "fill-primary text-primary")} />
                                  </Button>
                                </div>
                              </Card>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Pinned Notes Grid */}
                    {pinnedNotes.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Documents</h3>
                        <NotesGrid 
                          notesList={pinnedNotes} 
                          handleOpenEditor={handleOpenEditor} 
                          handleDeleteDocument={handleDeleteDocument} 
                          isAdmin={isAdmin} 
                          activeStaff={activeStaff} 
                          profileId={profile?.id} 
                          foldersList={folders} 
                          onMoveNote={handleOpenMoveNote}
                          onTogglePin={handleToggleNotePin}
                          onToggleFavorite={handleToggleNoteFavorite}
                        />
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* Custom note folders grid */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-muted-foreground/80 uppercase tracking-wider">Folders</h2>
                  {filteredFolders.length > (isMobile ? 6 : 12) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsFoldersExpanded(!isFoldersExpanded)}
                      className="h-7 text-xs font-semibold text-primary hover:bg-primary/5 rounded-lg cursor-pointer"
                    >
                      {isFoldersExpanded ? "Show Less" : `View All (${filteredFolders.length})`}
                    </Button>
                  )}
                </div>
                {filteredFolders.length === 0 ? (
                  <div className="text-xs text-muted-foreground italic py-3 bg-muted/10 rounded-xl px-4 border border-dashed border-border/40 flex items-center justify-between">
                    <span>No custom folders created yet. click "New Folder" to set up your directory.</span>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {visibleFolders.map(sf => {
                      const associatedClient = sf.client_id ? clients.find(cl => cl.id === sf.client_id) : null;
                      return (
                        <Card
                          key={sf.id}
                          className="group relative flex items-center justify-between p-3 rounded-xl border border-border/60 hover:border-primary/40 bg-card hover:bg-muted/10 transition-all duration-200 !shadow-none overflow-hidden"
                        >
                          <div
                            onClick={() => setActiveFolderId(sf.id)}
                            className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                          >
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                              <Folder className="h-4.5 w-4.5" />
                            </div>
                            <div className="flex flex-col min-w-0 pr-8">
                              <span className="font-semibold text-sm truncate group-hover:text-primary transition-colors flex items-center gap-1.5">
                                <span className="truncate">{sf.name}</span>
                                {sf.is_favorite && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 shrink-0" />}
                                {sf.is_pinned && <Pin className="h-3 w-3 text-primary fill-primary shrink-0" />}
                              </span>
                              <span className="text-[10px] text-muted-foreground font-medium truncate">
                                {associatedClient ? associatedClient.company_name : "Personal / Internal"} • {getSubFolderNoteCount(sf.id)} notes
                              </span>
                            </div>
                          </div>

                          {/* Folder action controls */}
                          {/* Desktop controls */}
                          <div className="hidden md:flex items-center gap-0.5 absolute right-2 top-1/2 -translate-y-1/2 bg-card/95 dark:bg-card/95 border border-border/40 pl-2 pr-1 py-1 rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all duration-200 shadow-lg z-10">
                            {/* Pin / Star Quick Toggles */}
                            <Button
                              size="icon"
                              variant="ghost"
                              className={cn(
                                "h-7 w-7 rounded-lg hover:bg-muted cursor-pointer text-muted-foreground/60 hover:text-yellow-500"
                              )}
                              onClick={() => handleToggleFolderFavorite(sf)}
                              title={sf.is_favorite ? "Remove from Favorites" : "Add to Favorites"}
                            >
                              <Star className={cn("h-3.5 w-3.5", sf.is_favorite && "fill-yellow-500 text-yellow-500")} />
                            </Button>

                            <Button
                              size="icon"
                              variant="ghost"
                              className={cn(
                                "h-7 w-7 rounded-lg hover:bg-muted cursor-pointer text-muted-foreground/60 hover:text-primary"
                              )}
                              onClick={() => handleToggleFolderPin(sf)}
                              title={sf.is_pinned ? "Unpin Folder" : "Pin Folder to Top"}
                            >
                              <Pin className={cn("h-3.5 w-3.5", sf.is_pinned && "fill-primary text-primary")} />
                            </Button>

                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 rounded-lg hover:bg-muted cursor-pointer text-muted-foreground/80 hover:text-foreground"
                              onClick={() => handleOpenFolderSharing(sf)}
                              title="Share Folder"
                            >
                              <Share2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 rounded-lg hover:bg-muted cursor-pointer text-muted-foreground/80 hover:text-foreground"
                              onClick={() => handleOpenMoveFolder(sf.id, sf.parent_id || null)}
                              title="Move Folder"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 rounded-lg hover:bg-muted cursor-pointer"
                              onClick={() => {
                                setRenameFolderId(sf.id);
                                setRenameFolderName(sf.name);
                                setRenameFolderOpen(true);
                              }}
                              title="Rename Folder"
                            >
                              <Edit className="h-3.5 w-3.5 text-muted-foreground/80 hover:text-foreground" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                              onClick={() => handleDeleteFolder(sf.id, sf.name)}
                              title="Delete Folder"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>

                          {/* Mobile controls */}
                          <div className="md:hidden flex items-center shrink-0">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 rounded-lg hover:bg-muted cursor-pointer text-muted-foreground/80 hover:text-foreground"
                                  title="Actions"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-[160px] rounded-xl p-1 shadow-lg bg-card border border-border/60 z-30">
                                <DropdownMenuItem
                                  onClick={() => handleToggleFolderPin(sf)}
                                  className="text-xs cursor-pointer rounded-lg focus:bg-muted/80 flex items-center gap-2"
                                >
                                  <Pin className="h-3.5 w-3.5" /> {sf.is_pinned ? "Unpin Folder" : "Pin Folder"}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleToggleFolderFavorite(sf)}
                                  className="text-xs cursor-pointer rounded-lg focus:bg-muted/80 flex items-center gap-2"
                                >
                                  <Star className="h-3.5 w-3.5" /> {sf.is_favorite ? "Unfavorite Folder" : "Favorite Folder"}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="my-1 border-t border-border/40" />
                                <DropdownMenuItem
                                  onClick={() => handleOpenFolderSharing(sf)}
                                  className="text-xs cursor-pointer rounded-lg focus:bg-muted/80 flex items-center gap-2"
                                >
                                  <Share2 className="h-3.5 w-3.5" /> Share Folder
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleOpenMoveFolder(sf.id, sf.parent_id || null)}
                                  className="text-xs cursor-pointer rounded-lg focus:bg-muted/80 flex items-center gap-2"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" /> Move Folder
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setRenameFolderId(sf.id);
                                    setRenameFolderName(sf.name);
                                    setRenameFolderOpen(true);
                                  }}
                                  className="text-xs cursor-pointer rounded-lg focus:bg-muted/80 flex items-center gap-2"
                                >
                                  <Edit className="h-3.5 w-3.5" /> Rename Folder
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="my-1 border-t border-border/40" />
                                <DropdownMenuItem
                                  onClick={() => handleDeleteFolder(sf.id, sf.name)}
                                  className="text-xs text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer rounded-lg flex items-center gap-2 font-semibold"
                                >
                                  <Trash2 className="h-3.5 w-3.5" /> Delete Folder
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Folder-less / Root notes of selected client filter */}
              <div className="space-y-3">
                <h2 className="text-sm font-bold text-muted-foreground/80 uppercase tracking-wider">Root Documents</h2>
                {filteredNotes.length === 0 ? (
                  <Card className="border border border-border/80 bg-muted/5 rounded-3xl py-12 flex flex-col items-center justify-center text-center">
                    <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center mb-3 text-muted-foreground/60">
                      <FileText className="h-5 w-5" />
                    </div>
                    <h3 className="font-semibold text-sm">No root notes found</h3>
                    <p className="text-muted-foreground text-xs max-w-[280px] mt-1 leading-relaxed">
                      All notes are filed inside custom folders, or none have been created. Click "New Document" to begin writing.
                    </p>
                  </Card>
                ) : (
                  <>
                    <NotesGrid notesList={filteredNotes.slice(0, visibleNotesCount)} handleOpenEditor={handleOpenEditor} handleDeleteDocument={handleDeleteDocument} isAdmin={isAdmin} activeStaff={activeStaff} profileId={profile?.id} foldersList={folders} onMoveNote={handleOpenMoveNote} onTogglePin={handleToggleNotePin} onToggleFavorite={handleToggleNoteFavorite} />
                    {filteredNotes.length > visibleNotesCount && (
                      <div className="flex justify-center pt-4">
                        <Button
                          onClick={() => setVisibleNotesCount(prev => prev + 21)}
                          variant="outline"
                          className="rounded-xl border-border/60 hover:bg-muted/50 font-semibold gap-1.5 px-6 cursor-pointer"
                        >
                          <RefreshCw className="h-4 w-4 text-muted-foreground animate-spin-hover" /> Load More Documents
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : (
            // Custom Sub-folder Detail view mode (Google Drive-like folders + documents layout)
            <div className="space-y-8">
              {filteredFolders.length === 0 && filteredNotes.length === 0 ? (
                <Card className="border border-dashed border-border/60 bg-muted/5 rounded-3xl py-12 flex flex-col items-center justify-center text-center">
                  <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mb-4 text-muted-foreground/60">
                    <FileText className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-base">Folder is empty</h3>
                  <p className="text-muted-foreground text-xs max-w-[320px] mt-1">
                    No folders or documents created in this subfolder yet. Click "New Folder" or "New Document" to add items.
                  </p>
                  <div className="flex gap-3 mt-4">
                    <Button
                      onClick={() => {
                        setNewFolderParentId(activeFolderId);
                        const activeFolder = folders.find(f => f.id === activeFolderId);
                        setNewFolderClientId(activeFolder?.client_id || "none");
                        setCreateFolderOpen(true);
                      }}
                      variant="outline"
                      className="rounded-xl gap-2 cursor-pointer text-xs shrink-0 border-border/60 hover:bg-muted/50"
                    >
                      <FolderPlus className="h-4 w-4" /> New Folder
                    </Button>
                    <Button
                      onClick={() => {
                        const targetFolder = folders.find(f => f.id === activeFolderId);
                        setCreateClientId(targetFolder?.client_id || "none");
                        setCreateFolderId(activeFolderId);
                        setCreateOpen(true);
                      }}
                      className="gradient-primary rounded-xl gap-2 cursor-pointer text-xs"
                    >
                      <Plus className="h-4 w-4" /> Create Document
                    </Button>
                  </div>
                </Card>
              ) : (
                <>
                  {/* Folders inside this active subfolder */}
                  {filteredFolders.length > 0 && (
                    <div className="space-y-3">
                      <h2 className="text-sm font-bold text-muted-foreground/80 uppercase tracking-wider">Folders ({filteredFolders.length})</h2>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {filteredFolders.map(sf => {
                          const associatedClient = sf.client_id ? clients.find(cl => cl.id === sf.client_id) : null;
                          return (
                            <Card
                              key={sf.id}
                              className="group relative flex items-center justify-between p-3 rounded-xl border border-border/60 hover:border-primary/40 bg-card hover:bg-muted/10 transition-all duration-200 !shadow-none overflow-hidden"
                            >
                              <div
                                onClick={() => setActiveFolderId(sf.id)}
                                className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                              >
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                                  <Folder className="h-4.5 w-4.5" />
                                </div>
                                <div className="flex flex-col min-w-0 pr-8">
                                  <span className="font-semibold text-sm truncate group-hover:text-primary transition-colors flex items-center gap-1.5">
                                    <span className="truncate">{sf.name}</span>
                                    {sf.is_favorite && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 shrink-0" />}
                                    {sf.is_pinned && <Pin className="h-3 w-3 text-primary fill-primary shrink-0" />}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground font-medium truncate">
                                    {associatedClient ? associatedClient.company_name : "Personal / Internal"} • {getSubFolderNoteCount(sf.id)} notes
                                  </span>
                                </div>
                              </div>

                              {/* Desktop controls */}
                              <div className="hidden md:flex items-center gap-0.5 absolute right-2 top-1/2 -translate-y-1/2 bg-card/95 dark:bg-card/95 border border-border/40 pl-2 pr-1 py-1 rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all duration-200 shadow-lg z-10">
                                {/* Pin / Star Quick Toggles */}
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className={cn(
                                    "h-7 w-7 rounded-lg hover:bg-muted cursor-pointer text-muted-foreground/60 hover:text-yellow-500"
                                  )}
                                  onClick={() => handleToggleFolderFavorite(sf)}
                                  title={sf.is_favorite ? "Remove from Favorites" : "Add to Favorites"}
                                >
                                  <Star className={cn("h-3.5 w-3.5", sf.is_favorite && "fill-yellow-500 text-yellow-500")} />
                                </Button>

                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className={cn(
                                    "h-7 w-7 rounded-lg hover:bg-muted cursor-pointer text-muted-foreground/60 hover:text-primary"
                                  )}
                                  onClick={() => handleToggleFolderPin(sf)}
                                  title={sf.is_pinned ? "Unpin Folder" : "Pin Folder to Top"}
                                >
                                  <Pin className={cn("h-3.5 w-3.5", sf.is_pinned && "fill-primary text-primary")} />
                                </Button>

                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 rounded-lg hover:bg-muted cursor-pointer text-muted-foreground/80 hover:text-foreground"
                                  onClick={() => handleOpenFolderSharing(sf)}
                                  title="Share Folder"
                                >
                                  <Share2 className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 rounded-lg hover:bg-muted cursor-pointer text-muted-foreground/80 hover:text-foreground"
                                  onClick={() => handleOpenMoveFolder(sf.id, sf.parent_id || null)}
                                  title="Move Folder"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 rounded-lg hover:bg-muted cursor-pointer"
                                  onClick={() => {
                                    setRenameFolderId(sf.id);
                                    setRenameFolderName(sf.name);
                                    setRenameFolderOpen(true);
                                  }}
                                  title="Rename Folder"
                                >
                                  <Edit className="h-3.5 w-3.5 text-muted-foreground/80 hover:text-foreground" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                                  onClick={() => handleDeleteFolder(sf.id, sf.name)}
                                  title="Delete Folder"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>

                              {/* Mobile controls */}
                              <div className="md:hidden flex items-center shrink-0">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8 rounded-lg hover:bg-muted cursor-pointer text-muted-foreground/80 hover:text-foreground"
                                      title="Actions"
                                    >
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-[160px] rounded-xl p-1 shadow-lg bg-card border border-border/60 z-30">
                                    <DropdownMenuItem
                                      onClick={() => handleToggleFolderPin(sf)}
                                      className="text-xs cursor-pointer rounded-lg focus:bg-muted/80 flex items-center gap-2"
                                    >
                                      <Pin className="h-3.5 w-3.5" /> {sf.is_pinned ? "Unpin Folder" : "Pin Folder"}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleToggleFolderFavorite(sf)}
                                      className="text-xs cursor-pointer rounded-lg focus:bg-muted/80 flex items-center gap-2"
                                    >
                                      <Star className="h-3.5 w-3.5" /> {sf.is_favorite ? "Unfavorite Folder" : "Favorite Folder"}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator className="my-1 border-t border-border/40" />
                                    <DropdownMenuItem
                                      onClick={() => handleOpenFolderSharing(sf)}
                                      className="text-xs cursor-pointer rounded-lg focus:bg-muted/80 flex items-center gap-2"
                                    >
                                      <Share2 className="h-3.5 w-3.5" /> Share Folder
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleOpenMoveFolder(sf.id, sf.parent_id || null)}
                                      className="text-xs cursor-pointer rounded-lg focus:bg-muted/80 flex items-center gap-2"
                                    >
                                      <ExternalLink className="h-3.5 w-3.5" /> Move Folder
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setRenameFolderId(sf.id);
                                        setRenameFolderName(sf.name);
                                        setRenameFolderOpen(true);
                                      }}
                                      className="text-xs cursor-pointer rounded-lg focus:bg-muted/80 flex items-center gap-2"
                                    >
                                      <Edit className="h-3.5 w-3.5" /> Rename Folder
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator className="my-1 border-t border-border/40" />
                                    <DropdownMenuItem
                                      onClick={() => handleDeleteFolder(sf.id, sf.name)}
                                      className="text-xs text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer rounded-lg flex items-center gap-2 font-semibold"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" /> Delete Folder
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Documents inside this active subfolder */}
                  {filteredNotes.length > 0 && (
                    <div className="space-y-3">
                      <h2 className="text-sm font-bold text-muted-foreground/80 uppercase tracking-wider">Documents ({filteredNotes.length})</h2>
                      <NotesGrid notesList={filteredNotes.slice(0, visibleNotesCount)} handleOpenEditor={handleOpenEditor} handleDeleteDocument={handleDeleteDocument} isAdmin={isAdmin} activeStaff={activeStaff} profileId={profile?.id} foldersList={folders} onMoveNote={handleOpenMoveNote} onTogglePin={handleToggleNotePin} onToggleFavorite={handleToggleNoteFavorite} />
                      {filteredNotes.length > visibleNotesCount && (
                        <div className="flex justify-center pt-4">
                          <Button
                            onClick={() => setVisibleNotesCount(prev => prev + 21)}
                            variant="outline"
                            className="rounded-xl border-border/60 hover:bg-muted/50 font-semibold gap-1.5 px-6 cursor-pointer"
                          >
                            <RefreshCw className="h-4 w-4 text-muted-foreground animate-spin-hover" /> Load More Documents
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="-mx-4 -mt-4 -mb-4 md:-mx-6 md:-mt-6 md:-mb-6 lg:-mx-8 lg:-mt-8 lg:-mb-8 pt-2 px-2 pb-0 md:pt-2.5 md:px-2.5 md:pb-0 lg:pt-3 lg:px-3 lg:pb-0 flex flex-col gap-2">
          {/* GOOGLE DOCS A4 EDITOR CANVAS VIEW */}
          <div className={cn(
            "flex flex-col bg-slate-50 dark:bg-slate-950 rounded-3xl border border-border/40 shadow-sm overflow-hidden",
            openNotes.length > 0
              ? "h-[calc(100vh-115px)] md:h-[calc(100vh-120px)] lg:h-[calc(100vh-122px)]"
              : "h-[calc(100vh-70px)] md:h-[calc(100vh-74px)] lg:h-[calc(100vh-78px)]"
          )}>
            {/* Header and Toolbar Wrapper */}
            <div className="bg-card shadow-sm rounded-t-3xl shrink-0">
              {/* Desktop Header Row (Hidden on mobile) */}
              <div className="hidden sm:flex flex-row items-center justify-between border-b border-border/50 bg-card py-3 px-3 shrink-0 rounded-t-3xl gap-4">
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  {/* Back button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleBackToDashboard}
                    className="h-8 w-8 rounded-full border border-border bg-background hover:bg-muted shrink-0 cursor-pointer"
                    title="Back to Notes"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>

                  {currentNote.permission_level === "edit" ? (
                    <input
                      type="text"
                      value={editorTitle}
                      onChange={e => {
                        setEditorTitle(e.target.value);
                        triggerImmediateSave(e.target.value, editorClientId, editorFolderId);
                      }}
                      className="text-base md:text-lg font-bold bg-transparent border-none focus:outline-none focus:ring-0 p-0 text-foreground flex-1 min-w-[200px] truncate font-bengali"
                      placeholder="Untitled Document"
                    />
                  ) : (
                    <h2 className="text-base md:text-lg font-bold p-0 text-foreground truncate flex-1 min-w-0 font-bengali">{editorTitle}</h2>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Desktop Move folder trigger */}
                  {currentNote.permission_level === "edit" && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-xl border border-border bg-background hover:bg-muted cursor-pointer shrink-0"
                          title="Move Document"
                        >
                          <Folder className="h-4 w-4 text-primary" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[280px] p-4 bg-card border border-border/60 rounded-2xl shadow-xl z-30" align="end">
                        <h4 className="font-semibold text-sm mb-3 flex items-center gap-1.5">
                          <Folder className="h-4 w-4 text-primary" /> Move Document
                        </h4>
                        <div className="space-y-4">
                          {/* Client Folder Selector */}
                          <div className="space-y-1.5">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Client Folder</span>
                            <Select
                              value={editorClientId || "none"}
                              onValueChange={v => {
                                const nextVal = v === "none" ? "" : v;
                                setEditorClientId(nextVal);
                                setEditorFolderId("");
                                triggerImmediateSave(editorTitle, nextVal, "");
                              }}
                            >
                              <SelectTrigger className="h-9 text-xs border border-border/60 bg-muted/20 hover:bg-muted/45 rounded-xl px-2.5 font-semibold text-foreground w-full">
                                <SelectValue placeholder="Internal / Personal" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none" className="text-xs cursor-pointer">Internal / Personal</SelectItem>
                                {clients.map(f => (
                                  <SelectItem key={f.id} value={f.id} className="text-xs cursor-pointer">
                                    {f.company_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Sub-folder Selector */}
                          <div className="space-y-1.5">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Subfolder</span>
                            <Select
                              value={editorFolderId || "none"}
                              onValueChange={v => {
                                const nextVal = v === "none" ? "" : v;
                                setEditorFolderId(nextVal);
                                triggerImmediateSave(editorTitle, editorClientId, nextVal);
                              }}
                            >
                              <SelectTrigger className="h-9 text-xs border border-border/60 bg-muted/20 hover:bg-muted/45 rounded-xl px-2.5 font-semibold text-foreground w-full">
                                <SelectValue placeholder="Root Folder" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none" className="text-xs cursor-pointer">Root Folder</SelectItem>
                                {editorFoldersOptions.map(f => (
                                  <SelectItem key={f.id} value={f.id} className="text-xs cursor-pointer">
                                    {f.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                  {/* Premium Cloud status badge */}
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-xl border text-xs font-semibold select-none shrink-0 h-9 transition-colors duration-200 ${saveStatus === "unsaved"
                    ? "bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/10 text-amber-600 dark:text-amber-500"
                    : "bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/10 text-emerald-600 dark:text-emerald-500"
                    }`}>
                    {saveStatus === "saving" ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
                        <span>Saving...</span>
                      </>
                    ) : saveStatus === "saved" ? (
                      <>
                        <Cloud className="h-4 w-4 shrink-0" />
                        <span>Saved to Cloud</span>
                      </>
                    ) : (
                      <>
                        <CloudOff className="h-4 w-4 shrink-0 text-amber-500" />
                        <span className="font-semibold">Unsaved</span>
                      </>
                    )}
                  </div>

                  {/* Active Collaborative Users */}
                  {activeUsers.length > 0 && (
                    <div className="flex items-center -space-x-2 mr-2 select-none shrink-0">
                      <TooltipProvider>
                        {activeUsers.map((user) => {
                          const userColor = getHashColor(user.user_id);
                          const initials = user.name
                            ? user.name.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase()
                            : "?";
                          return (
                            <Tooltip key={user.user_id}>
                              <TooltipTrigger asChild>
                                <Avatar
                                  className="h-8 w-8 rounded-full border-2 bg-background transition-transform hover:scale-105 hover:z-10 cursor-pointer shrink-0"
                                  style={{ borderColor: userColor }}
                                >
                                  {user.avatar_url && (
                                    <AvatarImage src={user.avatar_url} className="object-cover" />
                                  )}
                                  <AvatarFallback
                                    className="text-[10px] font-bold text-white uppercase"
                                    style={{ backgroundColor: userColor }}
                                  >
                                    {initials}
                                  </AvatarFallback>
                                </Avatar>
                              </TooltipTrigger>
                              <TooltipContent className="text-xs px-2.5 py-1 bg-popover border border-border shadow-md rounded-lg font-semibold text-popover-foreground">
                                {user.name} {user.user_id === profile?.id ? "(You)" : ""}
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </TooltipProvider>
                    </div>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOpenSharing}
                    className="h-9 rounded-xl border-border/60 hover:bg-muted/40 text-xs gap-1.5 cursor-pointer"
                  >
                    <Share2 className="h-4 w-4" /> Share Access
                  </Button>
                </div>
              </div>

              {/* Mobile Header Row (Super compact layout, matches Google Docs mobile app) */}
              <div className="flex sm:hidden flex-row items-center justify-between border-b border-border/50 bg-card p-2 shrink-0 rounded-t-3xl gap-2 w-full">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {/* Back button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleBackToDashboard}
                    className="h-8 w-8 rounded-full border border-border bg-background hover:bg-muted shrink-0 cursor-pointer"
                    title="Back to Notes"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>

                  {/* Title Input */}
                  {currentNote.permission_level === "edit" ? (
                    <input
                      type="text"
                      value={editorTitle}
                      onChange={e => {
                        setEditorTitle(e.target.value);
                        triggerImmediateSave(e.target.value, editorClientId, editorFolderId);
                      }}
                      className="text-sm font-bold bg-transparent border-none focus:outline-none focus:ring-0 p-0 text-foreground flex-1 min-w-0 truncate font-bengali"
                      placeholder="Untitled Document"
                    />
                  ) : (
                    <h2 className="text-sm font-bold p-0 text-foreground truncate flex-1 min-w-0 font-bengali">{editorTitle}</h2>
                  )}
                </div>

                {/* Action Controls */}
                <div className="flex items-center gap-1.5 shrink-0 select-none">
                  {/* Mobile Active Collaborative Users */}
                  {activeUsers.length > 0 && (
                    <div className="flex items-center -space-x-1.5 mr-1 select-none">
                      {activeUsers.slice(0, 3).map((user) => {
                        const userColor = getHashColor(user.user_id);
                        const initials = user.name
                          ? user.name.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase()
                          : "?";
                        return (
                          <Avatar
                            key={user.user_id}
                            className="h-7 w-7 rounded-full border bg-background shrink-0"
                            style={{ borderColor: userColor }}
                          >
                            {user.avatar_url && (
                              <AvatarImage src={user.avatar_url} className="object-cover" />
                            )}
                            <AvatarFallback
                              className="text-[9px] font-bold text-white uppercase"
                              style={{ backgroundColor: userColor }}
                            >
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                        );
                      })}
                      {activeUsers.length > 3 && (
                        <div className="h-7 w-7 rounded-full bg-muted border border-border flex items-center justify-center text-[9px] font-bold text-muted-foreground shrink-0 pl-0.5">
                          +{activeUsers.length - 3}
                        </div>
                      )}
                    </div>
                  )}
                  {/* Cloud status icon */}
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-xl border transition-colors duration-200 shrink-0",
                      saveStatus === "unsaved"
                        ? "bg-amber-500/5 border-amber-500/10 text-amber-600 dark:text-amber-500"
                        : "bg-emerald-500/5 border-emerald-500/10 text-emerald-600 dark:text-emerald-500"
                    )}
                    title={saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved to Cloud" : "Unsaved"}
                  >
                    {saveStatus === "saving" ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    ) : saveStatus === "saved" ? (
                      <Cloud className="h-4 w-4" />
                    ) : (
                      <CloudOff className="h-4 w-4 text-amber-500" />
                    )}
                  </div>

                  {/* Move folder trigger */}
                  {currentNote.permission_level === "edit" && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-xl border border-border bg-background hover:bg-muted cursor-pointer shrink-0"
                          title="Move Document"
                        >
                          <Folder className="h-4 w-4 text-primary" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[280px] p-4 bg-card border border-border/60 rounded-2xl shadow-xl z-30" align="end">
                        <h4 className="font-semibold text-sm mb-3 flex items-center gap-1.5">
                          <Folder className="h-4 w-4 text-primary" /> Move Document
                        </h4>
                        <div className="space-y-4">
                          {/* Client Folder Selector */}
                          <div className="space-y-1.5">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Client Folder</span>
                            <Select
                              value={editorClientId || "none"}
                              onValueChange={v => {
                                const nextVal = v === "none" ? "" : v;
                                setEditorClientId(nextVal);
                                setEditorFolderId("");
                                triggerImmediateSave(editorTitle, nextVal, "");
                              }}
                            >
                              <SelectTrigger className="h-9 text-xs border border-border/60 bg-muted/20 hover:bg-muted/40 rounded-xl px-2.5 font-semibold text-foreground w-full">
                                <SelectValue placeholder="Internal / Personal" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none" className="text-xs cursor-pointer">Internal / Personal</SelectItem>
                                {clients.map(f => (
                                  <SelectItem key={f.id} value={f.id} className="text-xs cursor-pointer">
                                    {f.company_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Sub-folder Selector */}
                          <div className="space-y-1.5">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Subfolder</span>
                            <Select
                              value={editorFolderId || "none"}
                              onValueChange={v => {
                                const nextVal = v === "none" ? "" : v;
                                setEditorFolderId(nextVal);
                                triggerImmediateSave(editorTitle, editorClientId, nextVal);
                              }}
                            >
                              <SelectTrigger className="h-9 text-xs border border-border/60 bg-muted/20 hover:bg-muted/40 rounded-xl px-2.5 font-semibold text-foreground w-full">
                                <SelectValue placeholder="Root Folder" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none" className="text-xs cursor-pointer">Root Folder</SelectItem>
                                {editorFoldersOptions.map(f => (
                                  <SelectItem key={f.id} value={f.id} className="text-xs cursor-pointer">
                                    {f.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}

                  {/* Share Access Trigger */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleOpenSharing}
                    className="h-8 w-8 rounded-xl border border-border bg-background hover:bg-muted cursor-pointer shrink-0"
                    title="Share Access"
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {/* Formatting Toolbar */}
              {currentNote.permission_level === "edit" ? (
                <div className="hidden md:flex flex-wrap items-center gap-0.5 bg-card/95 p-2 shrink-0 transition-all border-b border-border/40 select-none">

                  {/* Format Painter */}
                  <Button
                    size="icon"
                    variant={isFormatPainterActive ? "secondary" : "ghost"}
                    className={cn(
                      "h-8 w-8 hover:bg-muted cursor-pointer rounded-lg transition-colors shrink-0",
                      isFormatPainterActive && "bg-primary/15 text-primary hover:bg-primary/20 border border-primary/20"
                    )}
                    onMouseDown={e => {
                      e.preventDefault();
                      handleFormatPainterClick();
                    }}
                    title="Paint format"
                  >
                    <Paintbrush className="h-4 w-4" />
                  </Button>

                  <div className="h-4 w-[1px] bg-border mx-0.5 shrink-0" />

                  {/* Zoom */}
                  <Select value={zoom} onValueChange={setZoom}>
                    <SelectTrigger className="w-[64px] h-8 text-xs border border-transparent hover:border-border hover:bg-muted cursor-pointer rounded-lg shrink-0 px-1.5 gap-1 font-medium text-foreground">
                      <SelectValue placeholder="100%" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="50%" className="text-xs cursor-pointer">50%</SelectItem>
                      <SelectItem value="75%" className="text-xs cursor-pointer">75%</SelectItem>
                      <SelectItem value="90%" className="text-xs cursor-pointer">90%</SelectItem>
                      <SelectItem value="100%" className="text-xs cursor-pointer">100%</SelectItem>
                      <SelectItem value="125%" className="text-xs cursor-pointer">125%</SelectItem>
                      <SelectItem value="150%" className="text-xs cursor-pointer">150%</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="h-4 w-[1px] bg-border mx-0.5 shrink-0" />

                  {/* Text Format Style Dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-[96px] h-8 text-xs border border-transparent hover:border-border hover:bg-muted cursor-pointer rounded-lg shrink-0 px-1.5 font-medium text-foreground justify-between select-none"
                        title="Text style"
                      >
                        <span className="truncate text-left flex-1">
                          {selectedBlockFormat === "title"
                            ? "Title"
                            : selectedBlockFormat === "subtitle"
                              ? "Subtitle"
                              : selectedBlockFormat === "h1"
                                ? "Heading 1"
                                : selectedBlockFormat === "h2"
                                  ? "Heading 2"
                                  : selectedBlockFormat === "h3"
                                    ? "Heading 3"
                                    : "Normal text"}
                        </span>
                        <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0 ml-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-[200px] rounded-xl p-1.5 shadow-lg bg-card border border-border/60 z-30">
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedBlockFormat("p");
                          handleApplyStyle("formatBlock", "p");
                        }}
                        className="text-xs cursor-pointer rounded-lg focus:bg-muted/80 flex items-center justify-between py-1.5 px-2"
                      >
                        <span className="font-sans text-sm text-foreground">Normal text</span>
                        {selectedBlockFormat === "p" && <Check className="h-3.5 w-3.5 text-primary" />}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedBlockFormat("title");
                          handleApplyStyle("formatBlock", "h1");
                          handleApplyFontSize("6");
                        }}
                        className="text-xs cursor-pointer rounded-lg focus:bg-muted/80 flex items-center justify-between py-2 px-2"
                      >
                        <span className="font-bold text-2xl font-sans text-foreground">Title</span>
                        {selectedBlockFormat === "title" && <Check className="h-3.5 w-3.5 text-primary" />}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedBlockFormat("subtitle");
                          handleApplyStyle("formatBlock", "h2");
                          handleApplyFontSize("4");
                        }}
                        className="text-xs cursor-pointer rounded-lg focus:bg-muted/80 flex items-center justify-between py-2 px-2"
                      >
                        <span className="font-medium text-base font-sans text-muted-foreground">Subtitle</span>
                        {selectedBlockFormat === "subtitle" && <Check className="h-3.5 w-3.5 text-primary" />}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="my-1 border-t border-border/40" />
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedBlockFormat("h1");
                          handleApplyStyle("formatBlock", "h1");
                          handleApplyFontSize("5");
                        }}
                        className="text-xs cursor-pointer rounded-lg focus:bg-muted/80 flex items-center justify-between py-2 px-2"
                      >
                        <span className="font-bold text-xl font-sans text-foreground">Heading 1</span>
                        {selectedBlockFormat === "h1" && <Check className="h-3.5 w-3.5 text-primary" />}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedBlockFormat("h2");
                          handleApplyStyle("formatBlock", "h2");
                          handleApplyFontSize("4");
                        }}
                        className="text-xs cursor-pointer rounded-lg focus:bg-muted/80 flex items-center justify-between py-2 px-2"
                      >
                        <span className="font-bold text-lg font-sans text-foreground">Heading 2</span>
                        {selectedBlockFormat === "h2" && <Check className="h-3.5 w-3.5 text-primary" />}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedBlockFormat("h3");
                          handleApplyStyle("formatBlock", "h3");
                          handleApplyFontSize("3");
                        }}
                        className="text-xs cursor-pointer rounded-lg focus:bg-muted/80 flex items-center justify-between py-2 px-2"
                      >
                        <span className="font-semibold text-base font-sans text-foreground">Heading 3</span>
                        {selectedBlockFormat === "h3" && <Check className="h-3.5 w-3.5 text-primary" />}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="my-1 border-t border-border/40" />
                      <DropdownMenuItem
                        onClick={() => toast.info("Style options coming soon")}
                        className="text-xs cursor-pointer rounded-lg focus:bg-muted/80 flex items-center justify-between py-1.5 px-2 text-muted-foreground"
                      >
                        <span>Options</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <div className="h-4 w-[1px] bg-border mx-0.5 shrink-0" />

                  {/* Font Family Dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-[110px] h-8 text-xs border border-transparent hover:border-border hover:bg-muted cursor-pointer rounded-lg [&>span]:flex [&>span]:items-center [&>span]:gap-1 shrink-0 px-1.5 font-medium text-foreground justify-between select-none"
                        title="Font family"
                      >
                        <span className="truncate text-left flex-1">{selectedFont}</span>
                        <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0 ml-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-[220px] max-h-[400px] rounded-xl p-1 shadow-lg bg-card border border-border/60 z-30 flex flex-col">
                      <DropdownMenuItem
                        onClick={() => setIsMoreFontsOpen(true)}
                        className="text-xs cursor-pointer rounded-lg focus:bg-muted/80 flex items-center gap-2 py-1.5 px-2.5"
                      >
                        <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-semibold text-foreground">More fonts</span>
                      </DropdownMenuItem>

                      <DropdownMenuSeparator className="my-1 border-t border-border/40" />

                      <div className="px-2.5 py-1 text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider select-none">
                        Recent
                      </div>

                      {recentFonts.map(font => (
                        <DropdownMenuItem
                          key={`recent-${font}`}
                          onClick={() => {
                            setSelectedFont(font);
                            handleApplyStyle("fontName", font);
                          }}
                          className="text-xs cursor-pointer rounded-lg focus:bg-muted/80 flex items-center justify-between py-1.5 px-2.5"
                          style={{ fontFamily: font }}
                        >
                          <span className="text-foreground">{font}</span>
                          {selectedFont === font && <Check className="h-3.5 w-3.5 text-primary" />}
                        </DropdownMenuItem>
                      ))}

                      <DropdownMenuSeparator className="my-1 border-t border-border/40" />

                      <ScrollArea className="flex-1 max-h-[220px] overflow-y-auto">
                        <div className="flex flex-col gap-0.5 p-0.5">
                          {allAvailableFonts.map(font => (
                            <DropdownMenuItem
                              key={font}
                              onClick={() => {
                                setSelectedFont(font);
                                handleApplyStyle("fontName", font);
                                if (!recentFonts.includes(font)) {
                                  setRecentFonts(prev => [font, ...prev.filter(f => f !== font)].slice(0, 5));
                                }
                              }}
                              className="text-xs cursor-pointer rounded-lg focus:bg-muted/80 flex items-center justify-between py-1.5 px-2.5"
                              style={{ fontFamily: font }}
                            >
                              <span className="text-foreground">{font}</span>
                              {selectedFont === font && <Check className="h-3.5 w-3.5 text-primary" />}
                            </DropdownMenuItem>
                          ))}
                        </div>
                      </ScrollArea>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <div className="h-4 w-[1px] bg-border mx-0.5 shrink-0" />

                  {/* Font Size Panel */}
                  <div className="flex items-center space-x-1 shrink-0 h-8">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 hover:bg-muted text-foreground cursor-pointer rounded"
                      onClick={handleDecreaseFontSize}
                      title="Decrease font size"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>

                    <DropdownMenu
                      onOpenChange={(open) => {
                        if (open) {
                          saveSelection();
                        } else {
                          setTimeout(() => {
                            restoreSelection();
                            if (editorRef.current && document.activeElement !== editorRef.current) {
                              editorRef.current.focus();
                            }
                          }, 50);
                        }
                      }}
                    >
                      <DropdownMenuTrigger asChild>
                        <button
                          className="h-7 w-12 border border-border/80 rounded bg-background hover:bg-muted/50 text-center text-xs font-semibold text-foreground outline-none focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary data-[state=open]:ring-1 data-[state=open]:ring-primary data-[state=open]:border-primary transition-all cursor-pointer"
                          title="Font size"
                        >
                          {selectedFontSize}
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="min-w-[48px] max-h-[250px] overflow-y-auto bg-popover text-popover-foreground border border-border shadow-md rounded-md p-1">
                        {["8", "9", "10", "11", "12", "14", "18", "24", "30", "36", "48", "60", "72", "96"].map((sz) => (
                          <DropdownMenuItem
                            key={sz}
                            className={cn(
                              "relative flex items-center justify-center h-7 px-2 text-xs font-medium cursor-pointer rounded hover:bg-muted focus:bg-muted text-foreground transition-colors",
                              selectedFontSize === sz ? "bg-muted font-bold text-primary" : ""
                            )}
                            onSelect={(e) => {
                              e.preventDefault();
                              setSelectedFontSize(sz);
                              handleApplyFontSize(sz);
                            }}
                          >
                            {sz}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 hover:bg-muted text-foreground cursor-pointer rounded"
                      onClick={handleIncreaseFontSize}
                      title="Increase font size"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div className="h-4 w-[1px] bg-border mx-0.5 shrink-0" />

                  {/* Bold */}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 hover:bg-muted cursor-pointer rounded-lg text-foreground shrink-0"
                    onMouseDown={e => {
                      e.preventDefault();
                      handleApplyStyle("bold");
                    }}
                    title="Bold (Ctrl+B)"
                  >
                    <Bold className="h-4 w-4" />
                  </Button>

                  {/* Italic */}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 hover:bg-muted cursor-pointer rounded-lg text-foreground shrink-0"
                    onMouseDown={e => {
                      e.preventDefault();
                      handleApplyStyle("italic");
                    }}
                    title="Italic (Ctrl+I)"
                  >
                    <Italic className="h-4 w-4" />
                  </Button>

                  {/* Underline */}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 hover:bg-muted cursor-pointer rounded-lg text-foreground shrink-0"
                    onMouseDown={e => {
                      e.preventDefault();
                      handleApplyStyle("underline");
                    }}
                    title="Underline (Ctrl+U)"
                  >
                    <Underline className="h-4 w-4" />
                  </Button>

                  {/* Text Color Picker */}
                  <Popover open={isTextColorOpen} onOpenChange={(open) => {
                    if (open) {
                      saveSelection();
                    } else {
                      setTimeout(() => {
                        restoreSelection();
                      }, 50);
                    }
                    setIsTextColorOpen(open);
                  }}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-muted border border-transparent hover:border-border cursor-pointer rounded-lg flex flex-col items-center justify-center p-0 shrink-0"
                        title="Text color"
                      >
                        <span className="text-xs font-bold leading-none select-none relative top-[1px] text-foreground">A</span>
                        <div className="w-4 h-[3px] mt-[1px] rounded-full" style={{ backgroundColor: selectedColor }} />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-[260px] p-3 rounded-xl bg-card border border-border/60 shadow-lg z-30 flex flex-col gap-2 select-none">
                      {/* 10x8 Theme Color Grid */}
                      <div className="grid grid-cols-10 gap-1.5 justify-items-center">
                        {COLOR_PALETTE.map((color, index) => (
                          <button
                            key={`text-color-${color}-${index}`}
                            className={cn(
                              "w-5 h-5 rounded-full border border-border/40 cursor-pointer flex items-center justify-center transition-transform hover:scale-110",
                              selectedColor.toLowerCase() === color.toLowerCase() && "ring-1 ring-ring ring-offset-1"
                            )}
                            style={{ backgroundColor: color }}
                            onClick={() => {
                              restoreSelection();
                              setSelectedColor(color);
                              handleApplyStyle("foreColor", color);
                              setIsTextColorOpen(false);
                            }}
                          />
                        ))}
                      </div>

                      <DropdownMenuSeparator className="my-1 border-t border-border/40" />

                      {/* CUSTOM Section */}
                      <div className="flex flex-col gap-1.5">
                        <div className="text-[10px] font-bold text-muted-foreground/85 uppercase tracking-wider select-none">
                          Custom
                        </div>
                        <div className="flex flex-wrap gap-1.5 items-center">
                          <div
                            className="relative w-5 h-5 rounded-full border border-dashed border-muted-foreground/60 flex items-center justify-center hover:bg-muted cursor-pointer transition-colors"
                            title="Custom color"
                          >
                            <Plus className="h-3 w-3 text-muted-foreground" />
                            <input
                              type="color"
                              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                              onChange={(e) => handleCustomColorChange(e, "text")}
                            />
                          </div>
                          {customColors.map((color, idx) => (
                            <button
                              key={`custom-text-${color}-${idx}`}
                              className={cn(
                                "w-5 h-5 rounded-full border border-border/40 cursor-pointer flex items-center justify-center transition-transform hover:scale-110",
                                selectedColor.toLowerCase() === color.toLowerCase() && "ring-1 ring-ring ring-offset-1"
                              )}
                              style={{ backgroundColor: color }}
                              onClick={() => {
                                restoreSelection();
                                setSelectedColor(color);
                                handleApplyStyle("foreColor", color);
                                setIsTextColorOpen(false);
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>

                  {/* Highlight Color Picker */}
                  <Popover open={isHighlightColorOpen} onOpenChange={(open) => {
                    if (open) {
                      saveSelection();
                    } else {
                      setTimeout(() => {
                        restoreSelection();
                      }, 50);
                    }
                    setIsHighlightColorOpen(open);
                  }}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-muted border border-transparent hover:border-border cursor-pointer rounded-lg flex flex-col items-center justify-center p-0 shrink-0"
                        title="Highlight color"
                      >
                        <Highlighter className="h-4 w-4 text-foreground relative top-[1px]" />
                        <div className="w-4 h-[3px] mt-[1px] rounded-full" style={{ backgroundColor: selectedHighlightColor === "transparent" ? "#cbd5e1" : selectedHighlightColor }} />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-[260px] p-3 rounded-xl bg-card border border-border/60 shadow-lg z-30 flex flex-col gap-2 select-none">
                      {/* None Option */}
                      <button
                        className="text-xs font-medium cursor-pointer rounded-lg hover:bg-muted/80 flex items-center gap-2 py-1 px-2 text-foreground w-full transition-colors"
                        onClick={() => {
                          restoreSelection();
                          setSelectedHighlightColor("transparent");
                          handleApplyHighlight("transparent");
                          setIsHighlightColorOpen(false);
                        }}
                      >
                        <span className="w-4 h-4 rounded-full border border-border flex items-center justify-center bg-background relative overflow-hidden">
                          <div className="w-full h-[1.5px] bg-destructive rotate-45 absolute" />
                        </span>
                        <span>None</span>
                      </button>

                      <DropdownMenuSeparator className="my-1 border-t border-border/40" />

                      {/* 10x8 Theme Color Grid */}
                      <div className="grid grid-cols-10 gap-1.5 justify-items-center">
                        {COLOR_PALETTE.map((color, index) => (
                          <button
                            key={`highlight-color-${color}-${index}`}
                            className={cn(
                              "w-5 h-5 rounded-full border border-border/40 cursor-pointer flex items-center justify-center transition-transform hover:scale-110",
                              selectedHighlightColor.toLowerCase() === color.toLowerCase() && "ring-1 ring-ring ring-offset-1"
                            )}
                            style={{ backgroundColor: color }}
                            onClick={() => {
                              restoreSelection();
                              setSelectedHighlightColor(color);
                              handleApplyHighlight(color);
                              setIsHighlightColorOpen(false);
                            }}
                          />
                        ))}
                      </div>

                      <DropdownMenuSeparator className="my-1 border-t border-border/40" />

                      {/* CUSTOM Section */}
                      <div className="flex flex-col gap-1.5">
                        <div className="text-[10px] font-bold text-muted-foreground/85 uppercase tracking-wider select-none">
                          Custom
                        </div>
                        <div className="flex flex-wrap gap-1.5 items-center">
                          <div
                            className="relative w-5 h-5 rounded-full border border-dashed border-muted-foreground/60 flex items-center justify-center hover:bg-muted cursor-pointer transition-colors"
                            title="Custom highlight color"
                          >
                            <Plus className="h-3 w-3 text-muted-foreground" />
                            <input
                              type="color"
                              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                              onChange={(e) => handleCustomColorChange(e, "highlight")}
                            />
                          </div>
                          {customColors.map((color, idx) => (
                            <button
                              key={`custom-highlight-${color}-${idx}`}
                              className={cn(
                                "w-5 h-5 rounded-full border border-border/40 cursor-pointer flex items-center justify-center transition-transform hover:scale-110",
                                selectedHighlightColor.toLowerCase() === color.toLowerCase() && "ring-1 ring-ring ring-offset-1"
                              )}
                              style={{ backgroundColor: color }}
                              onClick={() => {
                                restoreSelection();
                                setSelectedHighlightColor(color);
                                handleApplyHighlight(color);
                                setIsHighlightColorOpen(false);
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>

                  <div className="h-4 w-[1px] bg-border mx-0.5 shrink-0" />

                  {/* Insert Link */}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 hover:bg-muted cursor-pointer rounded-lg shrink-0 text-foreground"
                    onClick={handleInsertLink}
                    title="Insert link"
                  >
                    <Link className="h-4 w-4" />
                  </Button>

                  {/* Add Comment placeholder */}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 hover:bg-muted cursor-pointer rounded-lg shrink-0 text-foreground"
                    onClick={() => toast.info("Comments feature coming soon")}
                    title="Add comment"
                  >
                    <MessageSquarePlus className="h-4 w-4" />
                  </Button>

                  {/* Insert Image */}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 hover:bg-muted cursor-pointer rounded-lg shrink-0 text-foreground"
                    onClick={() => imageFileInputRef.current?.click()}
                    title="Insert image"
                  >
                    <Image className="h-4 w-4" />
                  </Button>

                  <div className="h-4 w-[1px] bg-border mx-0.5 shrink-0" />

                  {/* Alignments Dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className="h-8 w-[46px] hover:bg-muted cursor-pointer rounded-lg flex items-center justify-center gap-1 shrink-0 text-foreground p-0"
                        title="Align"
                      >
                        {selectedAlignment === "left" && <AlignLeft className="h-4 w-4 shrink-0" />}
                        {selectedAlignment === "center" && <AlignCenter className="h-4 w-4 shrink-0" />}
                        {selectedAlignment === "right" && <AlignRight className="h-4 w-4 shrink-0" />}
                        {selectedAlignment === "justify" && <AlignJustify className="h-4 w-4 shrink-0" />}
                        <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="p-1 min-w-[40px] flex gap-0.5 bg-card border border-border/60 z-30">
                      <DropdownMenuItem
                        className="p-1.5 cursor-pointer rounded-lg focus:bg-muted flex items-center justify-center"
                        onClick={() => {
                          handleApplyStyle("justifyLeft");
                          setSelectedAlignment("left");
                        }}
                        title="Align Left"
                      >
                        <AlignLeft className="h-4 w-4" />
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="p-1.5 cursor-pointer rounded-lg focus:bg-muted flex items-center justify-center"
                        onClick={() => {
                          handleApplyStyle("justifyCenter");
                          setSelectedAlignment("center");
                        }}
                        title="Align Center"
                      >
                        <AlignCenter className="h-4 w-4" />
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="p-1.5 cursor-pointer rounded-lg focus:bg-muted flex items-center justify-center"
                        onClick={() => {
                          handleApplyStyle("justifyRight");
                          setSelectedAlignment("right");
                        }}
                        title="Align Right"
                      >
                        <AlignRight className="h-4 w-4" />
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="p-1.5 cursor-pointer rounded-lg focus:bg-muted flex items-center justify-center"
                        onClick={() => {
                          handleApplyStyle("justifyFull");
                          setSelectedAlignment("justify");
                        }}
                        title="Justify"
                      >
                        <AlignJustify className="h-4 w-4" />
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Line Spacing Dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className="h-8 w-[46px] hover:bg-muted cursor-pointer rounded-lg flex items-center justify-center gap-1 shrink-0 text-foreground p-0"
                        title="Line & paragraph spacing"
                      >
                        <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
                          <path d="M21 7H11" />
                          <path d="M21 12H11" />
                          <path d="M21 17H11" />
                          <path d="M3 10l3-3 3 3" />
                          <path d="M6 7v10" />
                          <path d="M3 14l3 3 3-3" />
                        </svg>
                        <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-[270px] rounded-xl p-1.5 shadow-lg bg-card border border-border/60 z-30 select-none">
                      <DropdownMenuItem
                        onClick={() => handleLineSpacing("1.0")}
                        className="text-xs cursor-pointer rounded-lg focus:bg-muted/80 flex items-center py-1.5 px-2 gap-2 text-foreground"
                      >
                        <div className="w-4 flex items-center justify-center shrink-0">
                          {selectedLineSpacing === "1.0" && <Check className="h-3.5 w-3.5 text-foreground/80" />}
                        </div>
                        <span>Single</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleLineSpacing("1.15")}
                        className="text-xs cursor-pointer rounded-lg focus:bg-muted/80 flex items-center py-1.5 px-2 gap-2 text-foreground"
                      >
                        <div className="w-4 flex items-center justify-center shrink-0">
                          {selectedLineSpacing === "1.15" && <Check className="h-3.5 w-3.5 text-foreground/80" />}
                        </div>
                        <span>1.15</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleLineSpacing("1.5")}
                        className="text-xs cursor-pointer rounded-lg focus:bg-muted/80 flex items-center py-1.5 px-2 gap-2 text-foreground"
                      >
                        <div className="w-4 flex items-center justify-center shrink-0">
                          {selectedLineSpacing === "1.5" && <Check className="h-3.5 w-3.5 text-foreground/80" />}
                        </div>
                        <span>1.5</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleLineSpacing("2.0")}
                        className="text-xs cursor-pointer rounded-lg focus:bg-muted/80 flex items-center py-1.5 px-2 gap-2 text-foreground"
                      >
                        <div className="w-4 flex items-center justify-center shrink-0">
                          {selectedLineSpacing === "2.0" && <Check className="h-3.5 w-3.5 text-foreground/80" />}
                        </div>
                        <span>Double</span>
                      </DropdownMenuItem>

                      <DropdownMenuSeparator className="my-1 border-t border-border/40" />

                      <DropdownMenuItem
                        onClick={() => handleParagraphSpace("before")}
                        className="text-xs cursor-pointer rounded-lg focus:bg-muted/80 flex items-center py-1.5 px-2 gap-2 text-foreground"
                      >
                        <div className="w-4 shrink-0" />
                        <span>{hasSpaceBefore ? "Remove space before paragraph" : "Add space before paragraph"}</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleParagraphSpace("after")}
                        className="text-xs cursor-pointer rounded-lg focus:bg-muted/80 flex items-center py-1.5 px-2 gap-2 text-foreground"
                      >
                        <div className="w-4 shrink-0" />
                        <span>{hasSpaceAfter ? "Remove space after paragraph" : "Add space after paragraph"}</span>
                      </DropdownMenuItem>

                      <DropdownMenuSeparator className="my-1 border-t border-border/40" />

                      <DropdownMenuItem
                        onClick={() => {
                          setCustomSpacingValue(selectedLineSpacing);
                          setIsCustomSpacingOpen(true);
                        }}
                        className="text-xs cursor-pointer rounded-lg focus:bg-muted/80 flex items-center py-1.5 px-2 gap-2 text-foreground"
                      >
                        <div className="w-4 shrink-0" />
                        <span>Custom spacing</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <div className="h-4 w-[1px] bg-border mx-0.5 shrink-0" />

                  {/* Lists (Checklist, Bullet, Numbered) */}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 hover:bg-muted cursor-pointer rounded-lg shrink-0"
                    onClick={handleInsertTaskList}
                    title="Checklist"
                  >
                    <ListTodo className="h-4 w-4 text-foreground" />
                  </Button>

                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 hover:bg-muted cursor-pointer rounded-lg shrink-0 text-foreground"
                    onClick={() => handleApplyStyle("insertUnorderedList")}
                    title="Bulleted list"
                  >
                    <List className="h-4 w-4" />
                  </Button>

                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 hover:bg-muted cursor-pointer rounded-lg shrink-0 text-foreground"
                    onClick={() => handleApplyStyle("insertOrderedList")}
                    title="Numbered list"
                  >
                    <ListOrdered className="h-4 w-4" />
                  </Button>

                  {/* Indents */}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 hover:bg-muted cursor-pointer rounded-lg shrink-0 text-foreground"
                    onClick={() => handleApplyStyle("outdent")}
                    title="Decrease indent"
                  >
                    <Outdent className="h-4 w-4" />
                  </Button>

                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 hover:bg-muted cursor-pointer rounded-lg shrink-0 text-foreground"
                    onClick={() => handleApplyStyle("indent")}
                    title="Increase indent"
                  >
                    <Indent className="h-4 w-4" />
                  </Button>



                  {isInsideTable && (
                    <>
                      <div className="h-4 w-[1px] bg-border mx-0.5 shrink-0" />

                      {/* Table Actions Dropdown */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 rounded-lg text-xs gap-1 cursor-pointer border border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 transition-colors shrink-0"
                          >
                            <Table2 className="h-3.5 w-3.5" /> Actions
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[180px] rounded-xl p-1 shadow-lg bg-card border border-border/60 z-30">
                          <DropdownMenuItem onClick={insertRowAbove} className="text-xs cursor-pointer rounded-lg focus:bg-muted/80">
                            Insert Row Above
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={insertRowBelow} className="text-xs cursor-pointer rounded-lg focus:bg-muted/80">
                            Insert Row Below
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="my-1 border-t border-border/40" />
                          <DropdownMenuItem onClick={insertColumnLeft} className="text-xs cursor-pointer rounded-lg focus:bg-muted/80">
                            Insert Column Left
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={insertColumnRight} className="text-xs cursor-pointer rounded-lg focus:bg-muted/80">
                            Insert Column Right
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="my-1 border-t border-border/40" />
                          <DropdownMenuItem onClick={deleteRow} className="text-xs text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer rounded-lg">
                            Delete Row
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={deleteColumn} className="text-xs text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer rounded-lg">
                            Delete Column
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="my-1 border-t border-border/40" />
                          <DropdownMenuItem onClick={deleteTable} className="text-xs text-destructive font-semibold focus:text-destructive focus:bg-destructive/10 cursor-pointer rounded-lg">
                            Delete Table
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  )}

                  {/* Eraser / Clear Formatting */}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 hover:bg-muted text-destructive cursor-pointer rounded-lg shrink-0 ml-auto"
                    onMouseDown={e => {
                      e.preventDefault();
                      handleApplyStyle("removeFormat");
                    }}
                    title="Clear Formatting"
                  >
                    <Eraser className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-muted/90 p-2 shrink-0 text-xs text-muted-foreground px-4 py-2 font-medium border-b border-border/40">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" /> Read-Only Mode. You do not have permissions to edit this document.
                </div>
              )}
            </div>

            {/* Pageless Workspace Canvas */}
            <div className="flex-1 bg-background overflow-auto flex flex-col items-center min-h-[500px] rounded-none md:rounded-b-3xl relative">
              {/* Remote Caret Cursor Flags Overlay */}
              {remoteCursors.map((cursor) => {
                const coords = calculateCursorCoords(cursor.offset?.start);
                if (!coords) return null;
                const userColor = getHashColor(cursor.userId);
                return (
                  <div
                    key={cursor.userId}
                    className="absolute pointer-events-none z-45 transition-all duration-75"
                    style={{
                      top: `${coords.top}px`,
                      left: `${coords.left}px`,
                      height: `${coords.height}px`
                    }}
                  >
                    {/* Caret visual marker line */}
                    <div
                      className="w-[2px] h-full animate-pulse"
                      style={{ backgroundColor: userColor }}
                    />
                    {/* Floating username flag */}
                    <div
                      className="absolute bottom-full left-0 px-1.5 py-0.5 rounded text-[10px] font-bold text-white whitespace-nowrap opacity-90 border border-white/10"
                      style={{ backgroundColor: userColor }}
                    >
                      {cursor.name}
                    </div>
                  </div>
                );
              })}

              {/* Floating Menu Button */}
              {floatingMenuCoords && (
                <div
                  className="absolute z-50 flex items-center justify-center transition-all duration-150"
                  style={{
                    top: `${floatingMenuCoords.top + (floatingMenuCoords.height - 28) / 2}px`,
                    left: `${floatingMenuCoords.left}px`,
                    height: "28px",
                  }}
                >
                  <Popover open={isPopoverOpen} onOpenChange={(open) => {
                    if (isAudioActionActive) {
                      setIsPopoverOpen(false);
                      isPopoverOpenRef.current = false;
                      return;
                    }
                    isPopoverOpenRef.current = open;
                    setIsPopoverOpen(open);
                  }}>
                    <PopoverTrigger asChild>
                      <Button
                        size="icon"
                        variant={isAudioActionActive ? "destructive" : "ghost"}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          if (isAudioActionActive) {
                            if (isListening) stopListening();
                            if (isRecording) stopRecording();
                          }
                        }}
                        onClick={(e) => {
                          if (isAudioActionActive) {
                            e.preventDefault();
                            e.stopPropagation();
                          }
                        }}
                        className={cn(
                          "h-7 w-7 rounded-full border shadow-sm shrink-0 cursor-pointer transition-all duration-200",
                          isAudioActionActive
                            ? "bg-destructive text-destructive-foreground hover:bg-destructive/90 animate-pulse border-destructive"
                            : "bg-muted/80 hover:bg-primary/20 text-muted-foreground hover:text-primary border-border"
                        )}
                        title={
                          isTranscribing
                            ? "Transcribing..."
                            : isUploadingAudio
                              ? "Uploading audio..."
                              : isListening
                                ? "Stop Dictation"
                                : isRecording
                                  ? "Stop Recording"
                                  : "Insert block"
                        }
                      >
                        {isTranscribing || isUploadingAudio ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : isListening ? (
                          <Mic className="h-4 w-4 text-white animate-bounce" />
                        ) : isRecording ? (
                          <AudioLines className="h-4 w-4 text-white animate-bounce" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-1 bg-popover border border-border shadow-md rounded-xl" align="start" side="right" sideOffset={8}>
                      <div className="flex flex-col gap-0.5">
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            saveSelection();
                          }}
                          onClick={() => handleFloatingMenuOption("dictate")}
                          className="flex items-center gap-2.5 px-3 py-2 text-xs text-left font-medium text-foreground hover:bg-muted rounded-lg cursor-pointer transition-colors"
                        >
                          <Mic className="h-4 w-4 text-purple-500" />
                          <div>
                            <div className="font-semibold font-sans">Dictate</div>
                            <div className="text-[10px] text-muted-foreground font-normal font-sans">Speech-to-text input</div>
                          </div>
                        </button>
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            saveSelection();
                          }}
                          onClick={() => handleFloatingMenuOption("voice")}
                          className="flex items-center gap-2.5 px-3 py-2 text-xs text-left font-medium text-foreground hover:bg-muted rounded-lg cursor-pointer transition-colors"
                        >
                          <AudioLines className="h-4 w-4 text-indigo-500" />
                          <div>
                            <div className="font-semibold font-sans">Voice Note</div>
                            <div className="text-[10px] text-muted-foreground font-normal font-sans">Record and attach audio</div>
                          </div>
                        </button>
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            saveSelection();
                          }}
                          onClick={() => handleFloatingMenuOption("image")}
                          className="flex items-center gap-2.5 px-3 py-2 text-xs text-left font-medium text-foreground hover:bg-muted rounded-lg cursor-pointer transition-colors"
                        >
                          <HardDrive className="h-4 w-4 text-blue-500" />
                          <div>
                            <div className="font-semibold font-sans">Image / Slider</div>
                            <div className="text-[10px] text-muted-foreground font-normal font-sans">Upload images or slider</div>
                          </div>
                        </button>
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            saveSelection();
                          }}
                          onClick={() => handleFloatingMenuOption("todo")}
                          className="flex items-center gap-2.5 px-3 py-2 text-xs text-left font-medium text-foreground hover:bg-muted rounded-lg cursor-pointer transition-colors"
                        >
                          <ListTodo className="h-4 w-4 text-emerald-500" />
                          <div>
                            <div className="font-semibold font-sans">To-do List</div>
                            <div className="text-[10px] text-muted-foreground font-normal font-sans">Task list with checkboxes</div>
                          </div>
                        </button>
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            saveSelection();
                          }}
                          onClick={() => handleFloatingMenuOption("table")}
                          className="flex items-center gap-2.5 px-3 py-2 text-xs text-left font-medium text-foreground hover:bg-muted rounded-lg cursor-pointer transition-colors"
                        >
                          <Table2 className="h-4 w-4 text-rose-500" />
                          <div>
                            <div className="font-semibold font-sans">Table</div>
                            <div className="text-[10px] text-muted-foreground font-normal font-sans font-sans">Insert a 3 × 3 grid table</div>
                          </div>
                        </button>
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            saveSelection();
                          }}
                          onClick={() => handleFloatingMenuOption("text")}
                          className="flex items-center gap-2.5 px-3 py-2 text-xs text-left font-medium text-foreground hover:bg-muted rounded-lg cursor-pointer transition-colors"
                        >
                          <Type className="h-4 w-4 text-amber-500" />
                          <div>
                            <div className="font-semibold font-sans">Text</div>
                            <div className="text-[10px] text-muted-foreground font-normal font-sans">Write paragraph text</div>
                          </div>
                        </button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              )}
              <input
                type="file"
                ref={imageFileInputRef}
                multiple
                accept="image/*"
                className="hidden"
                onChange={handleImageFileChange}
              />
              <div
                ref={editorRef}
                contentEditable={currentNote.permission_level === "edit"}
                onInput={handleEditorInput}
                onPaste={handleEditorPaste}
                onMouseUp={handleEditorSelectionUpdate}
                onKeyUp={handleEditorSelectionUpdate}
                className={cn(
                  "editor-content w-full max-w-[850px] min-h-[70vh] bg-background focus:outline-none text-slate-800 dark:text-slate-200 font-sans pl-12 pr-6 md:px-12 py-8 transition-colors duration-200",
                  isFormatPainterActive ? "format-painter-cursor" : "cursor-text"
                )}
                style={{ outline: 'none', zoom: zoom === "100%" ? undefined : `${parseInt(zoom) / 100}` }}
              />
            </div>



            {/* Mobile Formatting Toolbar (Bottom sticky on mobile) */}
            {currentNote.permission_level === "edit" ? (
              <>
                <style>{`
                .no-scrollbar::-webkit-scrollbar {
                  display: none;
                }
              `}</style>
                <div
                  className="md:hidden flex items-center gap-1.5 bg-card/95 backdrop-blur-md border-t border-border/40 p-2 overflow-x-auto whitespace-nowrap shrink-0 no-scrollbar rounded-b-3xl"
                  style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                >
                  {/* Paint format */}
                  <Button
                    size="icon"
                    variant={isFormatPainterActive ? "secondary" : "ghost"}
                    className={cn(
                      "h-9 w-9 shrink-0 hover:bg-muted cursor-pointer rounded-lg transition-colors",
                      isFormatPainterActive && "bg-primary/15 text-primary hover:bg-primary/20 border border-primary/20"
                    )}
                    onMouseDown={e => {
                      e.preventDefault();
                      handleFormatPainterClick();
                    }}
                    title="Paint format"
                  >
                    <Paintbrush className="h-4.5 w-4.5" />
                  </Button>

                  <div className="h-5 w-[1px] bg-border shrink-0 mx-0.5" />

                  {/* Bold */}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 shrink-0 hover:bg-muted cursor-pointer rounded-lg"
                    onMouseDown={e => {
                      e.preventDefault();
                      handleApplyStyle("bold");
                    }}
                    title="Bold (Ctrl+B)"
                  >
                    <Bold className="h-4.5 w-4.5" />
                  </Button>

                  {/* Italic */}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 shrink-0 hover:bg-muted cursor-pointer rounded-lg"
                    onMouseDown={e => {
                      e.preventDefault();
                      handleApplyStyle("italic");
                    }}
                    title="Italic (Ctrl+I)"
                  >
                    <Italic className="h-4.5 w-4.5" />
                  </Button>

                  {/* Underline */}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 shrink-0 hover:bg-muted cursor-pointer rounded-lg"
                    onMouseDown={e => {
                      e.preventDefault();
                      handleApplyStyle("underline");
                    }}
                    title="Underline (Ctrl+U)"
                  >
                    <Underline className="h-4.5 w-4.5" />
                  </Button>

                  <div className="h-5 w-[1px] bg-border shrink-0 mx-0.5" />

                  {/* Bullet list */}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 shrink-0 hover:bg-muted cursor-pointer rounded-lg"
                    onMouseDown={e => {
                      e.preventDefault();
                      handleApplyStyle("insertUnorderedList");
                    }}
                    title="Bullet List"
                  >
                    <List className="h-4.5 w-4.5" />
                  </Button>

                  {/* Numbered list */}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 shrink-0 hover:bg-muted cursor-pointer rounded-lg"
                    onMouseDown={e => {
                      e.preventDefault();
                      handleApplyStyle("insertOrderedList");
                    }}
                    title="Numbered List"
                  >
                    <ListOrdered className="h-4.5 w-4.5" />
                  </Button>

                  <div className="h-5 w-[1px] bg-border shrink-0 mx-0.5" />

                  {/* Align Left */}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 shrink-0 hover:bg-muted cursor-pointer rounded-lg"
                    onMouseDown={e => {
                      e.preventDefault();
                      handleApplyStyle("justifyLeft");
                    }}
                    title="Align Left"
                  >
                    <AlignLeft className="h-4.5 w-4.5" />
                  </Button>

                  {/* Align Center */}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 shrink-0 hover:bg-muted cursor-pointer rounded-lg"
                    onMouseDown={e => {
                      e.preventDefault();
                      handleApplyStyle("justifyCenter");
                    }}
                    title="Align Center"
                  >
                    <AlignCenter className="h-4.5 w-4.5" />
                  </Button>

                  {/* Align Right */}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 shrink-0 hover:bg-muted cursor-pointer rounded-lg"
                    onMouseDown={e => {
                      e.preventDefault();
                      handleApplyStyle("justifyRight");
                    }}
                    title="Align Right"
                  >
                    <AlignRight className="h-4.5 w-4.5" />
                  </Button>

                  <div className="h-5 w-[1px] bg-border shrink-0 mx-0.5" />

                  {/* Eraser */}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 shrink-0 hover:bg-muted text-destructive cursor-pointer rounded-lg"
                    onMouseDown={e => {
                      e.preventDefault();
                      handleApplyStyle("removeFormat");
                    }}
                    title="Clear Formatting"
                  >
                    <Eraser className="h-4.5 w-4.5" />
                  </Button>

                  {/* Format options trigger */}
                  <Button
                    size="icon"
                    variant={isFormatPanelOpen ? "secondary" : "ghost"}
                    className={cn(
                      "h-9 w-9 shrink-0 hover:bg-muted cursor-pointer rounded-lg ml-auto transition-colors",
                      isFormatPanelOpen && "bg-primary/15 text-primary hover:bg-primary/20 border border-primary/20"
                    )}
                    onMouseDown={e => {
                      e.preventDefault();
                      setIsFormatPanelOpen(!isFormatPanelOpen);
                    }}
                    title="Format options"
                  >
                    <Baseline className="h-4.5 w-4.5" />
                  </Button>
                </div>

                {/* Mobile Bottom Format Panel Drawer */}
                {isFormatPanelOpen && (
                  <>
                    {/* Backdrop */}
                    <div
                      className="md:hidden fixed inset-0 z-40 bg-background/40 backdrop-blur-xs transition-opacity duration-300"
                      onClick={() => setIsFormatPanelOpen(false)}
                    />

                    {/* Slide up Drawer */}
                    <div className="md:hidden fixed inset-x-0 bottom-0 z-50 flex flex-col bg-card/98 backdrop-blur-md border-t border-border/60 rounded-t-3xl shadow-2xl max-h-[80vh] overflow-hidden transition-transform duration-300 transform translate-y-0 pb-safe">
                      {/* Drag Handle & Header */}
                      <div className="flex flex-col items-center shrink-0 border-b border-border/40 pb-2">
                        <div className="w-12 h-1.5 rounded-full bg-muted-foreground/20 my-3 cursor-pointer" onClick={() => setIsFormatPanelOpen(false)} />
                        <div className="flex items-center justify-between w-full px-5 pb-1">
                          <span className="text-base font-bold text-foreground">Format</span>
                          <button
                            onClick={() => setIsFormatPanelOpen(false)}
                            className="p-1 hover:bg-muted rounded-full cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Check className="h-5 w-5 text-primary" />
                          </button>
                        </div>
                      </div>

                      {/* Tabs */}
                      <div className="flex border-b border-border/40 bg-muted/10 shrink-0 select-none">
                        <button
                          onClick={() => setActiveFormatTab("text")}
                          className={cn(
                            "flex-1 py-3 text-center text-sm font-bold border-b-2 transition-colors duration-200 cursor-pointer",
                            activeFormatTab === "text"
                              ? "border-primary text-primary"
                              : "border-transparent text-muted-foreground hover:text-foreground"
                          )}
                        >
                          Text
                        </button>
                        <button
                          onClick={() => setActiveFormatTab("paragraph")}
                          className={cn(
                            "flex-1 py-3 text-center text-sm font-bold border-b-2 transition-colors duration-200 cursor-pointer",
                            activeFormatTab === "paragraph"
                              ? "border-primary text-primary"
                              : "border-transparent text-muted-foreground hover:text-foreground"
                          )}
                        >
                          Paragraph
                        </button>
                      </div>

                      {/* Drawer Content Area */}
                      <div className="flex-1 overflow-y-auto p-5 space-y-6">
                        {activeFormatTab === "text" ? (
                          /* TEXT TAB CONTENT */
                          <div className="space-y-6">
                            {/* Font selector */}
                            <div className="space-y-2">
                              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Font Family</label>
                              <Select
                                value={selectedFont}
                                onValueChange={v => {
                                  setSelectedFont(v);
                                  handleApplyStyle("fontName", v);
                                }}
                                onOpenChange={open => {
                                  if (open) {
                                    saveSelection();
                                  } else {
                                    setTimeout(() => {
                                      restoreSelection();
                                      if (editorRef.current && document.activeElement !== editorRef.current) {
                                        editorRef.current.focus();
                                      }
                                    }, 50);
                                  }
                                }}
                              >
                                <SelectTrigger className="w-full h-11 text-sm border border-border/60 cursor-pointer rounded-xl bg-background [&>span]:flex [&>span]:items-center px-3.5">
                                  <span className="truncate">{selectedFont}</span>
                                </SelectTrigger>
                                <SelectContent className="max-h-[300px]">
                                  <SelectItem value="Inter" className="text-sm font-sans cursor-pointer">Inter</SelectItem>
                                  <SelectItem value="Roboto" className="text-sm font-sans cursor-pointer">Roboto</SelectItem>
                                  <SelectItem value="Outfit" className="text-sm font-sans cursor-pointer">Outfit</SelectItem>
                                  <SelectItem value="Poppins" className="text-sm font-sans cursor-pointer">Poppins</SelectItem>
                                  <SelectItem value="Montserrat" className="text-sm font-sans cursor-pointer">Montserrat</SelectItem>
                                  <SelectItem value="Open Sans" className="text-sm font-sans cursor-pointer">Open Sans</SelectItem>
                                  <SelectItem value="Lato" className="text-sm font-sans cursor-pointer">Lato</SelectItem>
                                  <SelectItem value="Josefin Sans" className="text-sm font-sans cursor-pointer">Josefin Sans</SelectItem>
                                  <SelectItem value="Ubuntu" className="text-sm font-sans cursor-pointer">Ubuntu</SelectItem>
                                  <SelectItem value="Nunito" className="text-sm font-sans cursor-pointer">Nunito</SelectItem>
                                  <SelectItem value="Oswald" className="text-sm font-sans cursor-pointer" style={{ fontFamily: 'Oswald, sans-serif' }}>Oswald</SelectItem>
                                  <SelectItem value="Playfair Display" className="text-sm serif cursor-pointer" style={{ fontFamily: 'Playfair Display, serif' }}>Playfair Display</SelectItem>
                                  <SelectItem value="Lora" className="text-sm serif cursor-pointer" style={{ fontFamily: 'Lora, serif' }}>Lora</SelectItem>
                                  <SelectItem value="Merriweather" className="text-sm serif cursor-pointer" style={{ fontFamily: 'Merriweather, serif' }}>Merriweather</SelectItem>
                                  <SelectItem value="Cinzel" className="text-sm serif cursor-pointer" style={{ fontFamily: 'Cinzel, serif' }}>Cinzel</SelectItem>
                                  <SelectItem value="Fira Code" className="text-sm monospace cursor-pointer" style={{ fontFamily: 'Fira Code, monospace' }}>Fira Code</SelectItem>
                                  <SelectItem value="Source Code Pro" className="text-sm monospace cursor-pointer" style={{ fontFamily: 'Source Code Pro, monospace' }}>Source Code Pro</SelectItem>
                                  <SelectItem value="Pacifico" className="text-sm cursor-pointer" style={{ fontFamily: 'Pacifico, cursive' }}>Pacifico</SelectItem>
                                  <SelectItem value="Dancing Script" className="text-sm cursor-pointer" style={{ fontFamily: 'Dancing Script, cursive' }}>Dancing Script</SelectItem>
                                  <SelectItem value="Hind Siliguri" className="text-sm cursor-pointer" style={{ fontFamily: 'Hind Siliguri, sans-serif' }}>Hind Siliguri</SelectItem>
                                  <SelectItem value="Baloo Da 2" className="text-sm cursor-pointer" style={{ fontFamily: 'Baloo Da 2, cursive' }}>Baloo Da 2</SelectItem>
                                  <SelectItem value="Anek Bangla" className="text-sm cursor-pointer" style={{ fontFamily: 'Anek Bangla, sans-serif' }}>Anek Bangla</SelectItem>
                                  <SelectItem value="Noto Sans Bengali" className="text-sm cursor-pointer" style={{ fontFamily: 'Noto Sans Bengali, sans-serif' }}>Noto Sans Bengali</SelectItem>
                                  <SelectItem value="Noto Serif Bengali" className="text-sm cursor-pointer" style={{ fontFamily: 'Noto Serif Bengali, serif' }}>Noto Serif Bengali</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Font Size Selector */}
                            <div className="space-y-2">
                              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Font Size</label>
                              <Select
                                value={selectedFontSize}
                                onValueChange={v => {
                                  setSelectedFontSize(v);
                                  handleApplyFontSize(v);
                                }}
                                onOpenChange={open => {
                                  if (open) {
                                    saveSelection();
                                  } else {
                                    setTimeout(() => {
                                      restoreSelection();
                                      if (editorRef.current && document.activeElement !== editorRef.current) {
                                        editorRef.current.focus();
                                      }
                                    }, 50);
                                  }
                                }}
                              >
                                <SelectTrigger className="w-full h-11 text-sm border border-border/60 cursor-pointer rounded-xl bg-background px-3.5">
                                  <SelectValue placeholder="Font Size" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[250px] overflow-y-auto">
                                  {["8", "9", "10", "11", "12", "14", "18", "24", "30", "36", "48", "60", "72", "96"].map((sz) => (
                                    <SelectItem key={sz} value={sz} className="text-sm cursor-pointer">
                                      {sz} px {sz === "16" ? "(Default)" : ""}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Text Format (Headings/Paragraph) */}
                            <div className="space-y-2">
                              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Text Format</label>
                              <Select
                                onValueChange={v => {
                                  handleApplyStyle("formatBlock", v);
                                }}
                                onOpenChange={open => {
                                  if (open) {
                                    saveSelection();
                                  } else {
                                    setTimeout(() => {
                                      restoreSelection();
                                      if (editorRef.current && document.activeElement !== editorRef.current) {
                                        editorRef.current.focus();
                                      }
                                    }, 50);
                                  }
                                }}
                              >
                                <SelectTrigger className="w-full h-11 text-sm border border-border/60 cursor-pointer rounded-xl bg-background px-3.5">
                                  <SelectValue placeholder="Paragraph / Heading" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="p" className="text-sm cursor-pointer">Paragraph</SelectItem>
                                  <SelectItem value="h1" className="text-sm font-bold cursor-pointer">Heading 1</SelectItem>
                                  <SelectItem value="h2" className="text-sm font-bold cursor-pointer">Heading 2</SelectItem>
                                  <SelectItem value="h3" className="text-sm font-bold cursor-pointer">Heading 3</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Text Color (Solid circular buttons) */}
                            <div className="space-y-2.5">
                              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">Text Color</label>
                              <div className="flex flex-wrap items-center gap-3">
                                {[
                                  { value: "#000000", label: "Default" },
                                  { value: "#2563eb", label: "Blue" },
                                  { value: "#dc2626", label: "Red" },
                                  { value: "#16a34a", label: "Green" },
                                  { value: "#eab308", label: "Yellow" },
                                  { value: "#7c3aed", label: "Violet" }
                                ].map((colorObj) => {
                                  const isCurrent = selectedColor === colorObj.value;
                                  return (
                                    <button
                                      key={colorObj.value}
                                      onClick={() => {
                                        setSelectedColor(colorObj.value);
                                        handleApplyStyle("foreColor", colorObj.value);
                                      }}
                                      className={cn(
                                        "h-10 w-10 rounded-full border shadow-sm transition-transform active:scale-95 cursor-pointer relative flex items-center justify-center",
                                        isCurrent ? "scale-110 border-primary border-2 shadow" : "border-border/60"
                                      )}
                                      style={{ backgroundColor: colorObj.value === "#000000" ? "#fff" : colorObj.value }}
                                      title={colorObj.label}
                                    >
                                      {isCurrent && (
                                        <Check
                                          className={cn(
                                            "h-5 w-5",
                                            colorObj.value === "#000000" || colorObj.value === "#eab308" ? "text-slate-900" : "text-white"
                                          )}
                                        />
                                      )}
                                      {colorObj.value === "#000000" && !isCurrent && (
                                        <span className="text-[10px] text-slate-800 font-bold">Default</span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Highlight Color */}
                            <div className="space-y-2.5">
                              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">Highlight Color</label>
                              <div className="flex flex-wrap items-center gap-3">
                                {[
                                  { value: "transparent", label: "None" },
                                  { value: "#fef08a", label: "Yellow" },
                                  { value: "#bbf7d0", label: "Green" },
                                  { value: "#bfdbfe", label: "Blue" },
                                  { value: "#fbcfe8", label: "Pink" },
                                  { value: "#fed7aa", label: "Orange" }
                                ].map((colorObj) => {
                                  const isCurrent = selectedHighlightColor === colorObj.value;
                                  return (
                                    <button
                                      key={colorObj.value}
                                      onClick={() => {
                                        setSelectedHighlightColor(colorObj.value);
                                        handleApplyHighlight(colorObj.value);
                                      }}
                                      className={cn(
                                        "h-10 w-10 rounded-full border shadow-sm transition-transform active:scale-95 cursor-pointer relative flex items-center justify-center",
                                        isCurrent ? "scale-110 border-primary border-2 shadow" : "border-border/60"
                                      )}
                                      style={{ backgroundColor: colorObj.value === "transparent" ? "#fff" : colorObj.value }}
                                      title={colorObj.label}
                                    >
                                      {isCurrent && (
                                        <Check
                                          className={cn(
                                            "h-5 w-5",
                                            colorObj.value === "transparent" || colorObj.value === "#fef08a" ? "text-slate-900" : "text-white"
                                          )}
                                        />
                                      )}
                                      {colorObj.value === "transparent" && !isCurrent && (
                                        <span className="text-[10px] text-slate-800 font-bold">None</span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Quick Character Styling */}
                            <div className="space-y-2">
                              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Quick Styling</label>
                              <div className="grid grid-cols-4 gap-2">
                                <Button
                                  size="lg"
                                  variant="outline"
                                  className="rounded-xl cursor-pointer hover:bg-muted text-foreground flex items-center justify-center h-12"
                                  onMouseDown={e => {
                                    e.preventDefault();
                                    handleApplyStyle("bold");
                                  }}
                                >
                                  <Bold className="h-5 w-5" />
                                </Button>
                                <Button
                                  size="lg"
                                  variant="outline"
                                  className="rounded-xl cursor-pointer hover:bg-muted text-foreground flex items-center justify-center h-12"
                                  onMouseDown={e => {
                                    e.preventDefault();
                                    handleApplyStyle("italic");
                                  }}
                                >
                                  <Italic className="h-5 w-5" />
                                </Button>
                                <Button
                                  size="lg"
                                  variant="outline"
                                  className="rounded-xl cursor-pointer hover:bg-muted text-foreground flex items-center justify-center h-12"
                                  onMouseDown={e => {
                                    e.preventDefault();
                                    handleApplyStyle("underline");
                                  }}
                                >
                                  <Underline className="h-5 w-5" />
                                </Button>
                                <Button
                                  size="lg"
                                  variant="outline"
                                  className="rounded-xl cursor-pointer hover:bg-muted text-destructive flex items-center justify-center h-12"
                                  onMouseDown={e => {
                                    e.preventDefault();
                                    handleApplyStyle("removeFormat");
                                  }}
                                  title="Clear formatting"
                                >
                                  <Eraser className="h-5 w-5" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* PARAGRAPH TAB CONTENT */
                          <div className="space-y-6">
                            {/* Alignments */}
                            <div className="space-y-2">
                              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Alignment</label>
                              <div className="grid grid-cols-4 gap-2">
                                <Button
                                  size="lg"
                                  variant="outline"
                                  className="rounded-xl cursor-pointer hover:bg-muted text-foreground flex items-center justify-center h-12"
                                  onMouseDown={e => {
                                    e.preventDefault();
                                    handleApplyStyle("justifyLeft");
                                  }}
                                >
                                  <AlignLeft className="h-5 w-5" />
                                </Button>
                                <Button
                                  size="lg"
                                  variant="outline"
                                  className="rounded-xl cursor-pointer hover:bg-muted text-foreground flex items-center justify-center h-12"
                                  onMouseDown={e => {
                                    e.preventDefault();
                                    handleApplyStyle("justifyCenter");
                                  }}
                                >
                                  <AlignCenter className="h-5 w-5" />
                                </Button>
                                <Button
                                  size="lg"
                                  variant="outline"
                                  className="rounded-xl cursor-pointer hover:bg-muted text-foreground flex items-center justify-center h-12"
                                  onMouseDown={e => {
                                    e.preventDefault();
                                    handleApplyStyle("justifyRight");
                                  }}
                                >
                                  <AlignRight className="h-5 w-5" />
                                </Button>
                                <Button
                                  size="lg"
                                  variant="outline"
                                  className="rounded-xl cursor-pointer hover:bg-muted text-foreground flex items-center justify-center h-12"
                                  onMouseDown={e => {
                                    e.preventDefault();
                                    handleApplyStyle("justifyFull");
                                  }}
                                >
                                  <AlignJustify className="h-5 w-5" />
                                </Button>
                              </div>
                            </div>

                            {/* Indents */}
                            <div className="space-y-2">
                              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Indents</label>
                              <div className="grid grid-cols-2 gap-2">
                                <Button
                                  size="lg"
                                  variant="outline"
                                  className="rounded-xl cursor-pointer hover:bg-muted text-foreground flex items-center justify-center h-12 gap-2 text-sm"
                                  onMouseDown={e => {
                                    e.preventDefault();
                                    handleApplyStyle("outdent");
                                  }}
                                >
                                  <Outdent className="h-5 w-5 text-primary" /> Decrease
                                </Button>
                                <Button
                                  size="lg"
                                  variant="outline"
                                  className="rounded-xl cursor-pointer hover:bg-muted text-foreground flex items-center justify-center h-12 gap-2 text-sm"
                                  onMouseDown={e => {
                                    e.preventDefault();
                                    handleApplyStyle("indent");
                                  }}
                                >
                                  <Indent className="h-5 w-5 text-primary" /> Increase
                                </Button>
                              </div>
                            </div>

                            {/* Line Spacing */}
                            <div className="space-y-2">
                              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Line Spacing</label>
                              <div className="grid grid-cols-4 gap-2">
                                <Button
                                  size="sm"
                                  variant={selectedLineSpacing === "1.0" ? "secondary" : "outline"}
                                  className={cn(
                                    "rounded-xl cursor-pointer hover:bg-muted text-xs h-10 transition-all duration-200",
                                    selectedLineSpacing === "1.0" && "bg-primary/15 text-primary hover:bg-primary/20 border border-primary/25 font-bold"
                                  )}
                                  onClick={() => handleLineSpacing("1.0")}
                                >
                                  Single
                                </Button>
                                <Button
                                  size="sm"
                                  variant={selectedLineSpacing === "1.15" ? "secondary" : "outline"}
                                  className={cn(
                                    "rounded-xl cursor-pointer hover:bg-muted text-xs h-10 transition-all duration-200",
                                    selectedLineSpacing === "1.15" && "bg-primary/15 text-primary hover:bg-primary/20 border border-primary/25 font-bold"
                                  )}
                                  onClick={() => handleLineSpacing("1.15")}
                                >
                                  1.15
                                </Button>
                                <Button
                                  size="sm"
                                  variant={selectedLineSpacing === "1.5" ? "secondary" : "outline"}
                                  className={cn(
                                    "rounded-xl cursor-pointer hover:bg-muted text-xs h-10 transition-all duration-200",
                                    selectedLineSpacing === "1.5" && "bg-primary/15 text-primary hover:bg-primary/20 border border-primary/25 font-bold"
                                  )}
                                  onClick={() => handleLineSpacing("1.5")}
                                >
                                  1.5
                                </Button>
                                <Button
                                  size="sm"
                                  variant={selectedLineSpacing === "2.0" ? "secondary" : "outline"}
                                  className={cn(
                                    "rounded-xl cursor-pointer hover:bg-muted text-xs h-10 transition-all duration-200",
                                    selectedLineSpacing === "2.0" && "bg-primary/15 text-primary hover:bg-primary/20 border border-primary/25 font-bold"
                                  )}
                                  onClick={() => handleLineSpacing("2.0")}
                                >
                                  Double
                                </Button>
                              </div>
                            </div>

                            {/* Lists */}
                            <div className="space-y-2">
                              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Lists</label>
                              <div className="grid grid-cols-2 gap-2">
                                <Button
                                  size="lg"
                                  variant="outline"
                                  className="rounded-xl cursor-pointer hover:bg-muted text-foreground flex items-center justify-center h-12 gap-2 text-sm"
                                  onMouseDown={e => {
                                    e.preventDefault();
                                    handleApplyStyle("insertUnorderedList");
                                  }}
                                >
                                  <List className="h-5 w-5 text-primary" /> Bullet List
                                </Button>
                                <Button
                                  size="lg"
                                  variant="outline"
                                  className="rounded-xl cursor-pointer hover:bg-muted text-foreground flex items-center justify-center h-12 gap-2 text-sm"
                                  onMouseDown={e => {
                                    e.preventDefault();
                                    handleApplyStyle("insertOrderedList");
                                  }}
                                >
                                  <ListOrdered className="h-5 w-5 text-primary" /> Numbered List
                                </Button>
                              </div>
                            </div>

                            {/* Table Insertion (Quick mobile grid selection 5x5) */}
                            <div className="space-y-3">
                              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                                {hoveredRowMobile > 0 && hoveredColMobile > 0 ? `Insert ${hoveredRowMobile} × ${hoveredColMobile} Table` : "Quick Insert Table"}
                              </label>
                              <div className="bg-muted/30 border border-border/50 rounded-2xl p-4 flex flex-col items-center justify-center">
                                <div
                                  className="grid grid-cols-5 gap-2.5"
                                  onMouseLeave={() => {
                                    setHoveredRowMobile(0);
                                    setHoveredColMobile(0);
                                  }}
                                >
                                  {Array.from({ length: 25 }).map((_, index) => {
                                    const r = Math.floor(index / 5) + 1;
                                    const c = (index % 5) + 1;
                                    const isHighlighted = r <= hoveredRowMobile && c <= hoveredColMobile;
                                    return (
                                      <div
                                        key={index}
                                        className={cn(
                                          "h-7 w-7 rounded-lg border border-border/70 cursor-pointer transition-all duration-100 flex items-center justify-center",
                                          isHighlighted
                                            ? "bg-primary border-primary shadow-sm"
                                            : "bg-background hover:bg-muted/80"
                                        )}
                                        onMouseEnter={() => {
                                          setHoveredRowMobile(r);
                                          setHoveredColMobile(c);
                                        }}
                                        onMouseDown={e => {
                                          e.preventDefault();
                                        }}
                                        onClick={() => {
                                          insertTable(r, c);
                                          setIsFormatPanelOpen(false);
                                          setHoveredRowMobile(0);
                                          setHoveredColMobile(0);
                                        }}
                                      />
                                    );
                                  })}
                                </div>
                                <span className="text-[10px] text-muted-foreground mt-3 font-semibold select-none">
                                  Drag or tap a cell above to insert table
                                </span>
                              </div>
                            </div>

                            {/* Table Actions (if inside a table) */}
                            {isInsideTable && (
                              <div className="space-y-3">
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">Table Actions</label>
                                <div className="grid grid-cols-2 gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={insertRowAbove}
                                    className="text-xs cursor-pointer rounded-xl h-10"
                                  >
                                    Insert Row Above
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={insertRowBelow}
                                    className="text-xs cursor-pointer rounded-xl h-10"
                                  >
                                    Insert Row Below
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={insertColumnLeft}
                                    className="text-xs cursor-pointer rounded-xl h-10"
                                  >
                                    Insert Col Left
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={insertColumnRight}
                                    className="text-xs cursor-pointer rounded-xl h-10"
                                  >
                                    Insert Col Right
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={deleteRow}
                                    className="text-xs cursor-pointer rounded-xl h-10 bg-destructive/10 text-destructive border-transparent hover:bg-destructive/20"
                                  >
                                    Delete Row
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={deleteColumn}
                                    className="text-xs cursor-pointer rounded-xl h-10 bg-destructive/10 text-destructive border-transparent hover:bg-destructive/20"
                                  >
                                    Delete Col
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={deleteTable}
                                    className="col-span-2 text-xs font-bold cursor-pointer rounded-xl h-10 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete Table
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </>
            ) : null}
          </div>

          {/* Bottom Tabs Bar */}
          {openNotes.length > 0 && (
            <>
              <style>{`
              .no-scrollbar::-webkit-scrollbar {
                display: none;
              }
            `}</style>
              <div
                className="flex items-center gap-2 mt-0 overflow-x-auto whitespace-nowrap select-none no-scrollbar py-1 w-full"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {openNotes.map((openNote) => {
                  const latestNote = notes.find(n => n.id === openNote.id) || openNote;
                  const isActive = currentNote?.id === openNote.id;
                  const displayTitle = isActive ? (editorTitle || "Untitled Document") : (latestNote.title || "Untitled Document");

                  return (
                    <div
                      key={openNote.id}
                      onClick={() => handleSwitchTab(latestNote)}
                      className={cn(
                        "group flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all duration-150 relative cursor-pointer",
                        isActive
                          ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/15 shadow-sm"
                          : "bg-card/65 text-muted-foreground border-border/40 hover:bg-card hover:text-foreground"
                      )}
                    >
                      <FileText className={cn("h-3.5 w-3.5 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                      <span className="max-w-[120px] md:max-w-[150px] truncate font-sans">
                        {displayTitle}
                      </span>
                      <button
                        onClick={(e) => handleCloseTab(openNote.id, e)}
                        className={cn(
                          "hover:bg-muted-foreground/20 text-muted-foreground hover:text-foreground rounded-full p-0.5 transition-all duration-150 h-4 w-4 flex items-center justify-center shrink-0",
                          isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                        )}
                        title="Close Tab"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}


      {/* Custom Spacing Dialog */}
      <Dialog open={isCustomSpacingOpen} onOpenChange={setIsCustomSpacingOpen}>
        <DialogContent className="sm:max-w-[350px] rounded-2xl p-6 bg-card border border-border/60">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">Custom spacing</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Adjust line spacing and paragraph margins.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 items-center gap-4">
              <Label htmlFor="line-spacing" className="text-xs font-semibold text-foreground">Line spacing</Label>
              <Input
                id="line-spacing"
                value={customSpacingValue}
                onChange={e => setCustomSpacingValue(e.target.value)}
                placeholder="1.15"
                className="h-8 text-xs rounded-lg"
              />
            </div>
            <div className="grid grid-cols-2 items-center gap-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-semibold text-foreground">Paragraph spacing</span>
                <span className="text-[10px] text-muted-foreground">(points)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex flex-col gap-1 w-full">
                  <span className="text-[9px] text-muted-foreground text-center">Before</span>
                  <Input
                    value={customSpaceBefore}
                    onChange={e => setCustomSpaceBefore(e.target.value)}
                    placeholder="0"
                    className="h-8 text-xs rounded-lg text-center"
                  />
                </div>
                <div className="flex flex-col gap-1 w-full">
                  <span className="text-[9px] text-muted-foreground text-center">After</span>
                  <Input
                    value={customSpaceAfter}
                    onChange={e => setCustomSpaceAfter(e.target.value)}
                    placeholder="0"
                    className="h-8 text-xs rounded-lg text-center"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCustomSpacingOpen(false)}
              className="text-xs rounded-lg h-8 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                handleApplyCustomSpacing(customSpacingValue, customSpaceBefore, customSpaceAfter);
                setIsCustomSpacingOpen(false);
              }}
              className="text-xs rounded-lg h-8 cursor-pointer"
            >
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Insert Link Dialog */}
      <Dialog open={isLinkModalOpen} onOpenChange={(open) => {
        if (!open) {
          setIsLinkModalOpen(false);
          setLinkUrl("");
          setLinkText("");
          setTimeout(() => {
            restoreSelection();
            if (editorRef.current && document.activeElement !== editorRef.current) {
              editorRef.current.focus();
            }
          }, 50);
        } else {
          setIsLinkModalOpen(true);
        }
      }}>
        <DialogContent className="sm:max-w-[400px] rounded-2xl p-6 bg-card border border-border/60">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">Insert link</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Add a hyperlink to your document.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="link-text" className="text-xs font-semibold text-foreground">Text to display</Label>
              <Input
                id="link-text"
                value={linkText}
                onChange={e => setLinkText(e.target.value)}
                placeholder="Google"
                className="h-9 text-xs rounded-lg bg-background border border-border/60"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="link-url" className="text-xs font-semibold text-foreground">Link URL</Label>
              <Input
                id="link-url"
                value={linkUrl}
                onChange={e => setLinkUrl(e.target.value)}
                placeholder="https://google.com"
                className="h-9 text-xs rounded-lg bg-background border border-border/60"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleInsertLinkSubmit();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsLinkModalOpen(false);
                setLinkUrl("");
                setLinkText("");
                setTimeout(() => {
                  restoreSelection();
                  if (editorRef.current && document.activeElement !== editorRef.current) {
                    editorRef.current.focus();
                  }
                }, 50);
              }}
              className="text-xs rounded-lg h-8 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleInsertLinkSubmit}
              className="text-xs rounded-lg h-8 cursor-pointer bg-primary hover:bg-primary/95 text-white"
            >
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Google Fonts Dialog */}
      <Dialog open={isMoreFontsOpen} onOpenChange={setIsMoreFontsOpen}>
        <DialogContent className="sm:max-w-[450px] rounded-2xl p-6 bg-card border border-border/60 flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">Google Fonts Manager</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Search and add any web font from Google Fonts. Once added, it will be available in the font family list.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div className="flex items-center gap-2">
              <Input
                value={fontSearchQuery}
                onChange={e => setFontSearchQuery(e.target.value)}
                placeholder="Type Google Font name (e.g. Lobster, Caveat, Teko)"
                className="h-9 text-xs rounded-lg flex-1"
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddGoogleFont(fontSearchQuery);
                  }
                }}
              />
              <Button
                size="sm"
                onClick={() => handleAddGoogleFont(fontSearchQuery)}
                className="text-xs rounded-lg h-9 cursor-pointer"
              >
                Add Font
              </Button>
            </div>

            {fontSearchQuery && (
              <div className="p-4 rounded-xl border border-border/50 bg-muted/30">
                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground select-none block mb-1">Preview ({fontSearchQuery})</span>
                <p
                  className="text-lg text-foreground truncate"
                  style={{ fontFamily: fontSearchQuery }}
                >
                  The quick brown fox jumps over the lazy dog.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-muted-foreground select-none block">Popular Google Fonts:</span>
              <ScrollArea className="h-[180px] w-full rounded-xl border border-border/50 p-2">
                <div className="grid grid-cols-2 gap-1.5">
                  {ADDITIONAL_POPULAR_FONTS.sort().map(font => (
                    <button
                      key={font}
                      onClick={() => handleAddGoogleFont(font)}
                      className="text-xs text-left cursor-pointer rounded-lg hover:bg-muted py-1.5 px-2.5 transition-colors border border-transparent hover:border-border/30 truncate flex items-center justify-between"
                      style={{ fontFamily: font }}
                    >
                      <span className="truncate">{font}</span>
                      <Plus className="h-3 w-3 text-muted-foreground shrink-0" />
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsMoreFontsOpen(false)}
              className="text-xs rounded-lg h-8 cursor-pointer w-full"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CREATE DOCUMENT DIALOG MODAL */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-[440px] bg-card/95 border border-border/60 rounded-3xl shadow-xl backdrop-blur-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" /> Create Document
            </DialogTitle>
            <DialogDescription>
              Create a new rich-text workspace document. You can associate it with a client or folder.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateDocument} className="space-y-4 my-2">
            <div className="space-y-1.5">
              <Label htmlFor="doc-title" className="text-xs font-semibold">Document Title</Label>
              <Input
                id="doc-title"
                placeholder="e.g. Project Specs or Meeting Notes"
                value={createTitle}
                onChange={e => setCreateTitle(e.target.value)}
                className="bg-muted/10 border-border/50 rounded-xl h-10"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="doc-client" className="text-xs font-semibold">Client Folder</Label>
              <Select
                value={createClientId}
                onValueChange={v => {
                  setCreateClientId(v);
                  setCreateFolderId("none"); // Reset folder selection
                }}
              >
                <SelectTrigger id="doc-client" className="w-full bg-muted/10 border border-border/50 rounded-xl cursor-pointer h-10">
                  <SelectValue placeholder="Internal / Personal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Internal / Personal</SelectItem>
                  {clients.map(f => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="doc-folder" className="text-xs font-semibold">Destination Folder</Label>
              <Select value={createFolderId} onValueChange={setCreateFolderId}>
                <SelectTrigger id="doc-folder" className="w-full bg-muted/10 border border-border/50 rounded-xl cursor-pointer h-10">
                  <SelectValue placeholder="Root (No custom folder)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Root (No custom folder)</SelectItem>
                  {creationFoldersOptions.map(f => (
                    <SelectItem key={f.id} value={f.id}>
                      {folderPathNames[f.id] || f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-4 border-t border-border/20">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                className="cursor-pointer rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={creating}
                className="gradient-primary cursor-pointer rounded-xl"
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  "Create Document"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* CREATE NOTES SUB-FOLDER DIALOG MODAL */}
      <Dialog open={createFolderOpen} onOpenChange={setCreateFolderOpen}>
        <DialogContent className="max-w-[400px] bg-card/95 border border-border/60 rounded-3xl shadow-xl backdrop-blur-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderPlus className="h-5 w-5 text-primary" /> Create Custom Folder
            </DialogTitle>
            <DialogDescription>
              Create a custom folder in Notes to categorize your documents.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateFolder} className="space-y-4 my-2">
            <div className="space-y-1.5">
              <Label htmlFor="folder-name" className="text-xs font-semibold">Folder Name</Label>
              <Input
                id="folder-name"
                placeholder="e.g. Invoices, Specifications, Drafts"
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                className="bg-muted/10 border-border/50 rounded-xl h-10"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="folder-client" className="text-xs font-semibold">Client Association (Optional)</Label>
              <Select value={newFolderClientId} onValueChange={setNewFolderClientId}>
                <SelectTrigger id="folder-client" className="w-full bg-muted/10 border border-border/50 rounded-xl cursor-pointer h-10">
                  <SelectValue placeholder="Internal / Personal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Internal / Personal</SelectItem>
                  {clients.map(f => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="folder-parent" className="text-xs font-semibold">Parent Folder (Optional)</Label>
              <Select value={newFolderParentId} onValueChange={setNewFolderParentId}>
                <SelectTrigger id="folder-parent" className="w-full bg-muted/10 border border-border/50 rounded-xl cursor-pointer h-10">
                  <SelectValue placeholder="Root (No parent folder)" />
                </SelectTrigger>
                <SelectContent className="max-h-[250px] overflow-y-auto">
                  <SelectItem value="none">Root (No parent folder)</SelectItem>
                  {folders.map(f => (
                    <SelectItem key={f.id} value={f.id}>
                      {folderPathNames[f.id] || f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-4 border-t border-border/20">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateFolderOpen(false)}
                className="cursor-pointer rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={creatingFolder}
                className="gradient-primary cursor-pointer rounded-xl"
              >
                {creatingFolder ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  "Create Folder"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* RENAME CUSTOM FOLDER DIALOG MODAL */}
      <Dialog open={renameFolderOpen} onOpenChange={setRenameFolderOpen}>
        <DialogContent className="max-w-[400px] bg-card/95 border border-border/60 rounded-3xl shadow-xl backdrop-blur-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-primary" /> Rename Folder
            </DialogTitle>
            <DialogDescription>
              Provide a new name for the custom notes folder.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRenameFolder} className="space-y-4 my-2">
            <div className="space-y-1.5">
              <Label htmlFor="rename-folder-name" className="text-xs font-semibold">Folder Name</Label>
              <Input
                id="rename-folder-name"
                placeholder="Folder Name"
                value={renameFolderName}
                onChange={e => setRenameFolderName(e.target.value)}
                className="bg-muted/10 border-border/50 rounded-xl h-10"
                required
              />
            </div>

            <DialogFooter className="pt-4 border-t border-border/20">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenameFolderOpen(false)}
                className="cursor-pointer rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={renamingFolder}
                className="gradient-primary cursor-pointer rounded-xl"
              >
                {renamingFolder ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  "Rename Folder"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MOVE DOCUMENT OR FOLDER DIALOG MODAL */}
      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent className="max-w-[400px] bg-card/95 border border-border/60 rounded-3xl shadow-xl backdrop-blur-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5 text-primary" /> Move {moveItemType === "note" ? "Document" : "Folder"}
            </DialogTitle>
            <DialogDescription>
              Select the destination folder to move this {moveItemType === "note" ? "document" : "folder"}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleMoveItem} className="space-y-4 my-2">
            <div className="space-y-1.5">
              <Label htmlFor="move-target" className="text-xs font-semibold">Destination Folder</Label>
              <Select value={moveTargetFolderId} onValueChange={setMoveTargetFolderId}>
                <SelectTrigger id="move-target" className="w-full bg-muted/10 border border-border/50 rounded-xl cursor-pointer h-10">
                  <SelectValue placeholder="Root (No folder)" />
                </SelectTrigger>
                <SelectContent className="max-h-[250px] overflow-y-auto">
                  <SelectItem value="none">Root (No folder)</SelectItem>
                  {moveFolderOptions.map(f => (
                    <SelectItem key={f.id} value={f.id}>
                      {folderPathNames[f.id] || f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-4 border-t border-border/20">
              <Button
                type="button"
                variant="outline"
                onClick={() => setMoveOpen(false)}
                className="cursor-pointer rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={movingItem}
                className="gradient-primary cursor-pointer rounded-xl"
              >
                {movingItem ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  "Confirm Move"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* SHARE DOCUMENT DIALOG MODAL */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-w-[480px] max-h-[85vh] flex flex-col bg-card/95 border border-border/60 rounded-3xl shadow-xl backdrop-blur-md">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" /> Share Document: {editorTitle}
            </DialogTitle>
            <DialogDescription>
              Assign view or edit access level to other staff members for this document.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 my-4 border border-border/40 rounded-2xl p-4 bg-muted/20">
            {activeStaff.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground italic">
                No active staff profiles found to share with.
              </div>
            ) : (
              <div className="space-y-3">
                {activeStaff.map(s => {
                  const sMap = sharingMap[s.id] || { selected: false, level: "view" };

                  if (currentNote && s.id === currentNote.created_by) {
                    return (
                      <div key={s.id} className="flex items-center justify-between gap-4 p-2.5 rounded-xl bg-muted/40 border border-border/30 opacity-80">
                        <span className="text-sm font-medium text-muted-foreground">
                          {s.full_name}
                        </span>
                        <Badge variant="outline" className="text-[10px] py-0 px-2 font-normal text-emerald-500 border-emerald-200/50 bg-emerald-500/5 dark:bg-emerald-500/10">
                          Creator / Owner
                        </Badge>
                      </div>
                    );
                  }

                  return (
                    <div key={s.id} className="flex items-center justify-between gap-4 p-2 rounded-xl hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id={`doc-share-${s.id}`}
                          checked={sMap.selected}
                          onCheckedChange={checked => handleShareCheck(s.id, !!checked)}
                        />
                        <Label htmlFor={`doc-share-${s.id}`} className="text-sm font-medium cursor-pointer">
                          {s.full_name}
                        </Label>
                      </div>

                      {sMap.selected && (
                        <Select
                          value={sMap.level}
                          onValueChange={level => handleShareLevelChange(s.id, level as "view" | "edit")}
                        >
                          <SelectTrigger className="w-[100px] h-8 text-xs cursor-pointer rounded-lg">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="view" className="text-xs cursor-pointer">View</SelectItem>
                            <SelectItem value="edit" className="text-xs cursor-pointer">Edit</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          <DialogFooter className="shrink-0 pt-2 border-t border-border/20">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShareOpen(false)}
              className="cursor-pointer rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveSharing}
              disabled={shareSubmitting}
              className="gradient-primary cursor-pointer rounded-xl"
            >
              {shareSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                "Save Sharing"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SHARE FOLDER DIALOG MODAL */}
      <Dialog open={shareFolderOpen} onOpenChange={setShareFolderOpen}>
        <DialogContent className="max-w-[480px] max-h-[85vh] flex flex-col bg-card/95 border border-border/60 rounded-3xl shadow-xl backdrop-blur-md">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" /> Share Folder: {activeFolderToShare?.name}
            </DialogTitle>
            <DialogDescription>
              Assign view or edit access level to other staff members for this folder and all notes inside it.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 my-4 border border-border/40 rounded-2xl p-4 bg-muted/20">
            {activeStaff.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground italic">
                No active staff profiles found to share with.
              </div>
            ) : (
              <div className="space-y-3">
                {activeStaff.map(s => {
                  const sMap = sharingFolderMap[s.id] || { selected: false, level: "view" };

                  if (activeFolderToShare && s.id === activeFolderToShare.created_by) {
                    return (
                      <div key={s.id} className="flex items-center justify-between gap-4 p-2.5 rounded-xl bg-muted/40 border border-border/30 opacity-80">
                        <span className="text-sm font-medium text-muted-foreground">
                          {s.full_name}
                        </span>
                        <Badge variant="outline" className="text-[10px] py-0 px-2 font-normal text-emerald-500 border-emerald-200/50 bg-emerald-500/5 dark:bg-emerald-500/10">
                          Creator / Owner
                        </Badge>
                      </div>
                    );
                  }

                  return (
                    <div key={s.id} className="flex items-center justify-between gap-4 p-2 rounded-xl hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id={`folder-share-${s.id}`}
                          checked={sMap.selected}
                          onCheckedChange={checked => handleFolderShareCheck(s.id, !!checked)}
                        />
                        <Label htmlFor={`folder-share-${s.id}`} className="text-sm font-medium cursor-pointer">
                          {s.full_name}
                        </Label>
                      </div>

                      {sMap.selected && (
                        <Select
                          value={sMap.level}
                          onValueChange={level => handleFolderShareLevelChange(s.id, level as "view" | "edit")}
                        >
                          <SelectTrigger className="w-[100px] h-8 text-xs cursor-pointer rounded-lg">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="view" className="text-xs cursor-pointer">View</SelectItem>
                            <SelectItem value="edit" className="text-xs cursor-pointer">Edit</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          <DialogFooter className="shrink-0 pt-2 border-t border-border/20">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShareFolderOpen(false)}
              className="cursor-pointer rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveFolderSharing}
              disabled={shareFolderSubmitting}
              className="gradient-primary cursor-pointer rounded-xl"
            >
              {shareFolderSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                "Save Sharing"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* FLOATING AUDIO ACTION CONTROL BOX */}
      {isAudioActionActive && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[80] bg-background/95 dark:bg-card/95 border border-border/80 shadow-2xl rounded-full pl-4 pr-2.5 py-2 flex items-center gap-4 animate-in slide-in-from-bottom-5 duration-300 ease-out backdrop-blur-md">
          <div className="flex items-center gap-2">
            {isTranscribing || isUploadingAudio ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
            ) : isListening ? (
              <div className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
              </div>
            ) : (
              <div className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive/60 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive"></span>
              </div>
            )}

            <span className="text-xs font-semibold text-foreground/90 whitespace-nowrap tracking-medium select-none">
              {isTranscribing
                ? "Transcribing voice..."
                : isUploadingAudio
                  ? "Uploading audio..."
                  : isListening
                    ? "Dictation Active (speak now)"
                    : "Recording Voice Note..."}
            </span>
          </div>

          <Button
            size="sm"
            variant="destructive"
            onMouseDown={(e) => {
              e.preventDefault();
              if (isListening) stopListening();
              if (isRecording) stopRecording();
            }}
            className="h-8 rounded-full px-4 text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5 transition-all duration-200 active:scale-95 bg-destructive hover:bg-destructive/95 text-white border-transparent"
          >
            <div className="w-1.5 h-1.5 bg-white rounded-xs shrink-0" />
            Stop
          </Button>
        </div>
      )}

      {/* FULL-SCREEN IMAGE LIGHTBOX VIEWER */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer border border-white/5"
            title="Close"
          >
            <Plus className="h-6 w-6 rotate-45" />
          </button>
          <div
            className="relative max-w-[92vw] max-h-[90vh] overflow-hidden rounded-2xl border border-white/10 shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <img src={lightboxUrl} alt="Zoomed view" className="max-w-full max-h-[90vh] object-contain rounded-2xl select-none" />
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-component: Mapped notes display card grid
interface NotesGridProps {
  notesList: NoteRow[];
  handleOpenEditor: (note: NoteRow) => void;
  handleDeleteDocument: (id: string, title: string) => void;
  isAdmin: boolean;
  activeStaff: Profile[];
  profileId: string | undefined;
  foldersList?: NoteFolder[];
  onMoveNote?: (id: string, currentFolderId: string | null) => void;
  onTogglePin?: (note: NoteRow) => void;
  onToggleFavorite?: (note: NoteRow) => void;
}

function NotesGrid({ notesList, handleOpenEditor, handleDeleteDocument, isAdmin, activeStaff, profileId, foldersList, onMoveNote, onTogglePin, onToggleFavorite }: NotesGridProps) {
  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
      {notesList.map(n => {
        const isOwned = n.created_by === profileId;

        return (
          <div
            key={n.id}
            className="group relative flex flex-col justify-between p-3.5 rounded-2xl border border-border/60 hover:border-primary/30 bg-card hover:bg-muted/10 hover:shadow-elegant transition-all duration-200 cursor-pointer min-h-[135px]"
            onClick={() => handleOpenEditor(n)}
          >
            {/* Card Top Row: File icon and actions dropdown */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileText className="h-4.5 w-4.5" />
              </div>

              <div className="flex-1" />

              {/* Pin & Favorite quick toggles (visible on hover, or permanently if active) */}
              <div className="flex items-center gap-0.5">
                {onToggleFavorite && (
                  <button
                    onClick={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      onToggleFavorite(n);
                    }}
                    className={cn(
                      "h-7 w-7 rounded-lg hover:bg-muted cursor-pointer flex items-center justify-center transition-all text-muted-foreground/60 hover:text-yellow-500",
                      n.is_favorite 
                        ? "text-yellow-500 opacity-100" 
                        : "opacity-0 group-hover:opacity-100"
                    )}
                    title={n.is_favorite ? "Remove from favorites" : "Add to favorites"}
                  >
                    <Star className={cn("h-3.5 w-3.5", n.is_favorite && "fill-yellow-500 text-yellow-500")} />
                  </button>
                )}
                {onTogglePin && (
                  <button
                    onClick={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      onTogglePin(n);
                    }}
                    className={cn(
                      "h-7 w-7 rounded-lg hover:bg-muted cursor-pointer flex items-center justify-center transition-all text-muted-foreground/60 hover:text-primary",
                      n.is_pinned 
                        ? "text-primary opacity-100" 
                        : "opacity-0 group-hover:opacity-100"
                    )}
                    title={n.is_pinned ? "Unpin note" : "Pin note to top"}
                  >
                    <Pin className={cn("h-3.5 w-3.5", n.is_pinned && "fill-primary text-primary")} />
                  </button>
                )}
              </div>

              {(isOwned || isAdmin) && (
                <div onClick={e => e.stopPropagation()} className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 rounded-lg hover:bg-muted cursor-pointer text-muted-foreground/80 hover:text-foreground"
                        title="Actions"
                      >
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[160px] rounded-xl p-1 shadow-lg bg-card border border-border/60 z-30">
                      {onTogglePin && (
                        <DropdownMenuItem
                          onClick={() => onTogglePin(n)}
                          className="text-xs cursor-pointer rounded-lg focus:bg-muted/80 flex items-center gap-2"
                        >
                          <Pin className="h-3.5 w-3.5" /> {n.is_pinned ? "Unpin Note" : "Pin Note"}
                        </DropdownMenuItem>
                      )}
                      {onToggleFavorite && (
                        <DropdownMenuItem
                          onClick={() => onToggleFavorite(n)}
                          className="text-xs cursor-pointer rounded-lg focus:bg-muted/80 flex items-center gap-2"
                        >
                          <Star className="h-3.5 w-3.5" /> {n.is_favorite ? "Unfavorite Note" : "Favorite Note"}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator className="my-1 border-t border-border/40" />
                      {onMoveNote && (
                        <DropdownMenuItem
                          onClick={() => onMoveNote(n.id, n.folder_id)}
                          className="text-xs cursor-pointer rounded-lg focus:bg-muted/80 flex items-center gap-2"
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> Move Document
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator className="my-1 border-t border-border/40" />
                      <DropdownMenuItem
                        onClick={() => handleDeleteDocument(n.id, n.title)}
                        className="text-xs text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer rounded-lg flex items-center gap-2 font-semibold"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete Document
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>

            {/* Card Middle: Title */}
            <div className="mt-2.5 flex-1 min-w-0">
              <h3 className="font-semibold text-xs leading-snug text-foreground group-hover:text-primary transition-colors line-clamp-2 font-bengali">
                {n.title.trim() || "Untitled Note"}
              </h3>
            </div>

            {/* Card Bottom: Timestamp */}
            <div className="mt-4 pt-2 border-t border-border/20 flex items-center justify-between text-[10px] text-muted-foreground shrink-0 select-none">
              <span className="truncate">
                {formatDate(n.updated_at)}
              </span>
              {n.folder_id && foldersList && (
                <span className="flex items-center gap-0.5 text-primary max-w-[55%] truncate" title={foldersList.find(f => f.id === n.folder_id)?.name}>
                  <Folder className="h-2.5 w-2.5 shrink-0" />
                  <span className="truncate font-semibold font-sans">
                    {foldersList.find(f => f.id === n.folder_id)?.name}
                  </span>
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}


interface SliderBlockProps {
  urls: string[];
  onViewImage?: (url: string) => void;
  onDelete: () => void;
}

const SliderBlock = ({ urls, onViewImage, onDelete }: SliderBlockProps) => {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!api) return;

    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap());

    api.on("select", () => {
      setCurrent(api.selectedScrollSnap());
    });
  }, [api]);

  return (
    <div className="relative w-full group select-none" contentEditable="false" suppressContentEditableWarning={true}>
      <Carousel setApi={setApi} opts={{ align: "start", loop: true }} className="w-full relative">
        <CarouselContent className="-ml-2">
          {urls.map((url, index) => (
            <CarouselItem key={index} className="pl-2 basis-full">
              <div
                className="relative aspect-video rounded-lg overflow-hidden border border-border/55 group/slide cursor-zoom-in"
                onClick={() => onViewImage?.(url)}
              >
                <img src={url} alt={`Slide ${index + 1}`} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/slide:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-9 h-9 rounded-full bg-black/60 flex items-center justify-center text-white backdrop-blur-xs border border-white/10 shadow-md">
                    <Maximize2 className="h-4.5 w-4.5" />
                  </div>
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        {urls.length > 1 && (
          <>
            <CarouselPrevious className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity" />
            <CarouselNext className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity" />
          </>
        )}
      </Carousel>

      {/* Pagination Indicator Dots */}
      {urls.length > 1 && count > 0 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10 bg-black/30 backdrop-blur-md px-2 py-1 rounded-full select-none border border-white/5">
          {Array.from({ length: count }).map((_, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                api?.scrollTo(index);
              }}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300 cursor-pointer border-none outline-none p-0",
                index === current ? "w-4 bg-white" : "w-1.5 bg-white/50 hover:bg-white/80"
              )}
              title={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}

      <Button
        size="icon"
        variant="destructive"
        className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg cursor-pointer animate-in fade-in zoom-in duration-200"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDelete();
        }}
        title="Delete Slider"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
};


