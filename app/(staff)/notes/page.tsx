"use client";

import { useEffect, useState, useRef, useMemo } from "react";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../../../components/ui/dropdown-menu";
import {
  FileText, Globe, Calendar, AlertTriangle, AlertCircle, ShieldCheck, Edit, Trash2, Plus,
  ExternalLink, Loader2, RefreshCw, Search, Folder, DollarSign, Bell, ArrowLeft, ChevronLeft, Save,
  Share2, Users, Bold, Italic, Underline, List, ListOrdered, AlignLeft, AlignCenter,
  AlignRight, Heading1, Heading2, Heading3, Palette, Eraser, Check, Cloud, CloudOff, Lock,
  ChevronRight, HardDrive, Type, FolderPlus, Paintbrush, Table2, Baseline, MoreVertical, SlidersHorizontal
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "../../../lib/format";
import { CardGridSkeleton } from "../../../components/loading-skeletons";
import { cn } from "../../../lib/utils";

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
}

interface ClientRow {
  id: string;
  company_name: string;
  permission_level?: "view" | "edit";
}

interface NoteFolder {
  id: string;
  name: string;
  client_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  shared_with?: SharedStaffMember[];
}

const SUPPORTED_FONTS = [
  "Inter", "Roboto", "Outfit", "Poppins", "Montserrat", "Open Sans",
  "Lato", "Josefin Sans", "Ubuntu", "Nunito", "Oswald",
  "Playfair Display", "Lora", "Merriweather", "Cinzel",
  "Fira Code", "Source Code Pro", "Pacifico", "Dancing Script",
  "Hind Siliguri", "Baloo Da 2", "Anek Bangla", "Noto Sans Bengali", "Noto Serif Bengali"
];

const SUPPORTED_COLORS = [
  "#2563eb", "#dc2626", "#16a34a", "#eab308", "#7c3aed"
];

const rgbToHex = (rgbStr: string) => {
  const matches = rgbStr.match(/\d+/g);
  if (matches && matches.length >= 3) {
    const r = parseInt(matches[0], 10);
    const g = parseInt(matches[1], 10);
    const b = parseInt(matches[2], 10);
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toLowerCase();
  }
  return "#000000";
};

export default function NotesPage() {
  const { profile, roles } = useAuth();
  const isAdmin = roles.includes("super_admin") || roles.includes("admin");

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
  const [creatingFolder, setCreatingFolder] = useState(false);

  // Rename custom notes folder state
  const [renameFolderOpen, setRenameFolderOpen] = useState(false);
  const [renameFolderId, setRenameFolderId] = useState("");
  const [renameFolderName, setRenameFolderName] = useState("");
  const [renamingFolder, setRenamingFolder] = useState(false);

  // Editor state
  const [currentNote, setCurrentNote] = useState<NoteRow | null>(null);
  const [editorTitle, setEditorTitle] = useState("");
  const [editorClientId, setEditorClientId] = useState<string>("");
  const [editorFolderId, setEditorFolderId] = useState<string>("");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const [selectedFont, setSelectedFont] = useState("Inter");
  const [selectedFontSize, setSelectedFontSize] = useState("16");
  const [selectedColor, setSelectedColor] = useState("#000000");
  const savedSelectionRef = useRef<Range | null>(null);
  const [isFormatPainterActive, setIsFormatPainterActive] = useState(false);
  const copiedStylesRef = useRef<{
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    fontName?: string;
    foreColor?: string;
  }>({});
  const [isInsideTable, setIsInsideTable] = useState(false);
  const [hoveredRow, setHoveredRow] = useState(0);
  const [hoveredCol, setHoveredCol] = useState(0);
  const [tableInsertOpen, setTableInsertOpen] = useState(false);
  const [hoveredRowMobile, setHoveredRowMobile] = useState(0);
  const [hoveredColMobile, setHoveredColMobile] = useState(0);
  const [tableInsertOpenMobile, setTableInsertOpenMobile] = useState(false);
  const [isFormatPanelOpen, setIsFormatPanelOpen] = useState(false);
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

  // Share Dialog state
  const [shareOpen, setShareOpen] = useState(false);
  const [shareSubmitting, setShareSubmitting] = useState(false);
  const [sharingMap, setSharingMap] = useState<Record<string, { selected: boolean; level: "view" | "edit" }>>({});

  // Folder Share Dialog state
  const [shareFolderOpen, setShareFolderOpen] = useState(false);
  const [shareFolderSubmitting, setShareFolderSubmitting] = useState(false);
  const [sharingFolderMap, setSharingFolderMap] = useState<Record<string, { selected: boolean; level: "view" | "edit" }>>({});
  const [activeFolderToShare, setActiveFolderToShare] = useState<NoteFolder | null>(null);

  useEffect(() => {
    void loadNotes();
    void loadClients();
    void loadNoteFolders();
    void loadActiveStaff();
  }, []);

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
        .in("role", ["staff", "project_manager", "super_admin"]);

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
      const targetClientId = newFolderClientId === "none" ? null : newFolderClientId;
      const res = await fetchWithAuth("/api/notes/folders", {
        method: "POST",
        body: JSON.stringify({
          name: newFolderName.trim(),
          client_id: targetClientId
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create folder");
      }
      toast.success("Folder created successfully");
      setNewFolderName("");
      setNewFolderClientId("none");
      setCreateFolderOpen(false);
      void loadNoteFolders();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to create folder");
    } finally {
      setCreatingFolder(false);
    }
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

    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = note.content || "<p><br></p>";
      }
    }, 50);
  };

  const handleBackToDashboard = async () => {
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

    setCurrentNote(null);
    void loadNotes();
  };

  const saveDocumentData = async (id: string, titleStr: string, clientStr: string, folderStr: string, contentStr: string) => {
    try {
      const originalNote = notes.find(n => n.id === id);
      const sharedStaff = originalNote ? originalNote.shared_with.map(s => ({
        staff_id: s.staff_id,
        permission_level: s.permission_level
      })) : [];

      const res = await fetchWithAuth("/api/notes", {
        method: "PUT",
        body: JSON.stringify({
          id,
          title: titleStr.trim(),
          content: contentStr,
          client_id: clientStr || null,
          folder_id: folderStr || null,
          shared_staff: sharedStaff
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

  const handleEditorInput = () => {
    if (!currentNote || currentNote.permission_level !== "edit") return;
    setSaveStatus("unsaved");

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
        editorRef.current?.innerHTML || ""
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
        try {
          const styles = copiedStylesRef.current;
          document.execCommand("styleWithCSS", false, "true");

          if (styles.bold !== document.queryCommandState("bold")) {
            document.execCommand("bold");
          }
          if (styles.italic !== document.queryCommandState("italic")) {
            document.execCommand("italic");
          }
          if (styles.underline !== document.queryCommandState("underline")) {
            document.execCommand("underline");
          }
          if (styles.fontName) {
            document.execCommand("fontName", false, styles.fontName);
          }
          if (styles.foreColor) {
            document.execCommand("foreColor", false, styles.foreColor);
          }

          setIsFormatPainterActive(false);
          copiedStylesRef.current = {};
          toast.success("Format applied successfully!");
          handleEditorInput();
        } catch (err) {
          console.error("Error applying format painter styles:", err);
        }
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
          const matchedSize = ["12px", "14px", "16px", "18px", "24px", "32px", "48px"].find(sz => sz === computedFontSize);
          if (matchedSize) {
            setSelectedFontSize(matchedSize.replace("px", ""));
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
          if (SUPPORTED_COLORS.includes(hex)) {
            setSelectedColor(hex);
          } else {
            setSelectedColor("#000000");
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
          const isBold = document.queryCommandState("bold");
          const isItalic = document.queryCommandState("italic");
          const isUnderline = document.queryCommandState("underline");
          const font = document.queryCommandValue("fontName");
          const color = document.queryCommandValue("foreColor");

          copiedStylesRef.current = {
            bold: isBold,
            italic: isItalic,
            underline: isUnderline,
            fontName: font ? font.replace(/['"]/g, "") : "",
            foreColor: color ? rgbToHex(color) : ""
          };

          setIsFormatPainterActive(true);
          toast.success("Format copied! Select text to apply.");
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
      editorRef.current?.innerHTML || ""
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
        document.execCommand("styleWithCSS", false, "false");
        document.execCommand("fontSize", false, sizeValue);
        document.execCommand("styleWithCSS", false, "true");
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

  // Filter custom folders list for main dashboard view based on clientFilter selection and search query
  const filteredFolders = useMemo(() => {
    return folders.filter(f => {
      if (searchQuery.trim()) {
        const matchesQuery = f.name.toLowerCase().includes(searchQuery.toLowerCase());
        const associatedClient = f.client_id ? clients.find(cl => cl.id === f.client_id) : null;
        const matchesClientName = associatedClient ? associatedClient.company_name.toLowerCase().includes(searchQuery.toLowerCase()) : false;
        if (!matchesQuery && !matchesClientName) return false;
      }
      if (clientFilter === "all") return true;
      if (clientFilter === "internal") return f.client_id === null;
      return f.client_id === clientFilter;
    });
  }, [folders, clientFilter, searchQuery, clients]);

  // Slice folders to display a maximum of 3 rows (12 items on desktop, 6 items on mobile) by default
  const visibleFolders = useMemo(() => {
    const limit = isMobile ? 6 : 12;
    return isFoldersExpanded ? filteredFolders : filteredFolders.slice(0, limit);
  }, [filteredFolders, isFoldersExpanded, isMobile]);

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
    <div className="space-y-6">
      {/* Editor CSS styles block: Custom typography styles */}
      <style dangerouslySetInnerHTML={{
        __html: `
        .editor-content { font-family: 'Inter', sans-serif; }
        .editor-content h1 { font-size: 2.25rem; font-weight: 800; margin-top: 1.5rem; margin-bottom: 0.75rem; line-height: 1.2; color: inherit; }
        .editor-content h2 { font-size: 1.75rem; font-weight: 700; margin-top: 1.25rem; margin-bottom: 0.5rem; color: inherit; }
        .editor-content h3 { font-size: 1.35rem; font-weight: 600; margin-top: 1rem; margin-bottom: 0.25rem; color: inherit; }
        .editor-content p { margin-top: 0.5rem; margin-bottom: 0.5rem; line-height: 1.7; color: inherit; }
        .editor-content ul { list-style-type: disc; padding-left: 1.75rem; margin-top: 0.5rem; margin-bottom: 0.5rem; }
        .editor-content ol { list-style-type: decimal; padding-left: 1.75rem; margin-top: 0.5rem; margin-bottom: 0.5rem; }
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
              {activeFolderId === null && !searchQuery.trim() && (
                <Button
                  onClick={() => setCreateFolderOpen(true)}
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
            </div>
          </div>

          {/* Breadcrumb for sub-folder view */}
          {activeFolderId !== null && !searchQuery.trim() && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground select-none">
              <span onClick={() => setActiveFolderId(null)} className="hover:text-primary cursor-pointer transition-colors font-medium">
                Notes
              </span>
              <ChevronRight className="h-3.5 w-3.5" />
              <Badge variant="outline" className="font-semibold px-2.5 py-0.5 rounded-full text-indigo-500 border-indigo-200/50 bg-indigo-500/5">
                {activeFolderName}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveFolderId(null)}
                className="h-7 text-xs ml-auto rounded-lg text-primary hover:bg-primary/5 cursor-pointer font-medium"
              >
                <ArrowLeft className="h-3 w-3 mr-1" /> Back to Dashboard
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
                          className="group flex items-center justify-between p-3 rounded-xl border border-border/60 hover:border-primary/40 bg-card hover:bg-muted/10 transition-all duration-200 !shadow-none"
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
                            <div className="flex flex-col min-w-0">
                              <span className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                                {sf.name}
                              </span>
                              <span className="text-[10px] text-muted-foreground font-medium truncate">
                                {associatedClient ? associatedClient.company_name : "Personal / Internal"} • {getSubFolderNoteCount(sf.id)} notes
                              </span>
                            </div>
                          </div>

                          {/* Desktop controls */}
                          <div className="hidden md:flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
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
                              <DropdownMenuContent align="end" className="w-[140px] rounded-xl p-1 shadow-lg bg-card border border-border/60 z-30">
                                <DropdownMenuItem
                                  onClick={() => handleOpenFolderSharing(sf)}
                                  className="text-xs cursor-pointer rounded-lg focus:bg-muted/80 flex items-center gap-2"
                                >
                                  <Share2 className="h-3.5 w-3.5" /> Share Folder
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
                    <NotesGrid notesList={filteredNotes.slice(0, visibleNotesCount)} handleOpenEditor={handleOpenEditor} handleDeleteDocument={handleDeleteDocument} isAdmin={isAdmin} activeStaff={activeStaff} profileId={profile?.id} foldersList={folders} />
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
                          className="group flex items-center justify-between p-3 rounded-xl border border-border/60 hover:border-primary/40 bg-card hover:bg-muted/10 transition-all duration-200 !shadow-none"
                        >
                          <div
                            onClick={() => setActiveFolderId(sf.id)}
                            className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                          >
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                              <Folder className="h-4.5 w-4.5" />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                                {sf.name}
                              </span>
                              <span className="text-[10px] text-muted-foreground font-medium truncate">
                                {associatedClient ? associatedClient.company_name : "Personal / Internal"} • {getSubFolderNoteCount(sf.id)} notes
                              </span>
                            </div>
                          </div>

                          {/* Folder action controls */}
                          {/* Desktop controls */}
                          <div className="hidden md:flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
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

                          {/* Mobile controls (Compact dropdown) */}
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
                              <DropdownMenuContent align="end" className="w-[140px] rounded-xl p-1 shadow-lg bg-card border border-border/60 z-30">
                                <DropdownMenuItem
                                  onClick={() => handleOpenFolderSharing(sf)}
                                  className="text-xs cursor-pointer rounded-lg focus:bg-muted/80 flex items-center gap-2"
                                >
                                  <Share2 className="h-3.5 w-3.5" /> Share Folder
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
                    <NotesGrid notesList={filteredNotes.slice(0, visibleNotesCount)} handleOpenEditor={handleOpenEditor} handleDeleteDocument={handleDeleteDocument} isAdmin={isAdmin} activeStaff={activeStaff} profileId={profile?.id} foldersList={folders} />
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
            // Custom Sub-folder Detail view mode
            <div className="space-y-4">
              {filteredNotes.length === 0 ? (
                <Card className="border border-dashed border-border/60 bg-muted/5 rounded-3xl py-12 flex flex-col items-center justify-center text-center">
                  <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mb-4 text-muted-foreground/60">
                    <FileText className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-base">Folder is empty</h3>
                  <p className="text-muted-foreground text-xs max-w-[320px] mt-1">
                    No documents created in this subfolder yet. Click "+ New Document" to write notes.
                  </p>
                  <Button
                    onClick={() => {
                      const targetFolder = folders.find(f => f.id === activeFolderId);
                      setCreateClientId(targetFolder?.client_id || "none");
                      setCreateFolderId(activeFolderId);
                      setCreateOpen(true);
                    }}
                    className="gradient-primary rounded-xl gap-2 mt-4 cursor-pointer text-xs"
                  >
                    <Plus className="h-4 w-4" /> Create Document
                  </Button>
                </Card>
              ) : (
                <>
                  <NotesGrid notesList={filteredNotes.slice(0, visibleNotesCount)} handleOpenEditor={handleOpenEditor} handleDeleteDocument={handleDeleteDocument} isAdmin={isAdmin} activeStaff={activeStaff} profileId={profile?.id} foldersList={folders} />
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
          )}
        </>
      ) : (
        // GOOGLE DOCS A4 EDITOR CANVAS VIEW
        <div className="flex flex-col bg-slate-50 dark:bg-slate-950 rounded-3xl border border-border/40 shadow-sm h-[calc(100vh-100px)] md:h-[calc(100vh-125px)] lg:h-[calc(100vh-150px)] overflow-hidden">
          {/* Header and Toolbar Wrapper */}
          <div className="bg-card shadow-sm rounded-t-3xl shrink-0">
            {/* Desktop Header Row (Hidden on mobile) */}
            <div className="hidden sm:flex flex-row items-center justify-between border-b border-border/50 bg-card p-3 shrink-0 rounded-t-3xl gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {/* Back button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleBackToDashboard}
                  className="h-9 w-9 rounded-full border border-border bg-background hover:bg-muted shrink-0 cursor-pointer"
                  title="Back to Notes"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>

                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 md:gap-3 w-full">
                    {currentNote.permission_level === "edit" ? (
                      <input
                        type="text"
                        value={editorTitle}
                        onChange={e => {
                          setEditorTitle(e.target.value);
                          triggerImmediateSave(e.target.value, editorClientId, editorFolderId);
                        }}
                        className="text-lg md:text-xl font-bold bg-transparent border-none focus:outline-none focus:ring-0 p-0 text-foreground flex-1 min-w-[200px] truncate font-bengali"
                        placeholder="Untitled Document"
                      />
                    ) : (
                      <h2 className="text-lg md:text-xl font-bold p-0 text-foreground truncate flex-1 min-w-0 font-bengali">{editorTitle}</h2>
                    )}
                  </div>

                  {/* Folder Selector dropdown row */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground select-none">
                    <div className="flex items-center gap-1 shrink-0">
                      <HardDrive className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                      <span className="whitespace-nowrap">Client Folder:</span>
                      {currentNote.permission_level === "edit" ? (
                        <Select
                          value={editorClientId || "none"}
                          onValueChange={v => {
                            const nextVal = v === "none" ? "" : v;
                            setEditorClientId(nextVal);
                            setEditorFolderId("");
                            triggerImmediateSave(editorTitle, nextVal, "");
                          }}
                        >
                          <SelectTrigger className="h-5 text-[11px] border-none shadow-none bg-muted/40 hover:bg-muted/70 rounded px-1.5 py-0.5 cursor-pointer font-semibold text-foreground max-w-[400px]">
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
                      ) : (
                        <span className="font-semibold text-foreground">
                          {currentNote.client_name || "Internal / Personal"}
                        </span>
                      )}
                    </div>

                    {/* Sub folder selection */}
                    <div className="flex items-center gap-1 border-l border-border pl-3 shrink-0">
                      <Folder className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                      <span className="whitespace-nowrap">Folder:</span>
                      {currentNote.permission_level === "edit" ? (
                        <Select
                          value={editorFolderId || "none"}
                          onValueChange={v => {
                            const nextVal = v === "none" ? "" : v;
                            setEditorFolderId(nextVal);
                            triggerImmediateSave(editorTitle, editorClientId, nextVal);
                          }}
                        >
                          <SelectTrigger className="h-5 text-[11px] border-none shadow-none bg-muted/40 hover:bg-muted/70 rounded px-1.5 py-0.5 cursor-pointer font-semibold text-foreground max-w-[350px]">
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
                      ) : (
                        <span className="font-semibold text-foreground">
                          {editorFolderId ? folders.find(fd => fd.id === editorFolderId)?.name : "Root"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
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
              <div className="hidden md:flex flex-wrap items-center gap-1 bg-card/95 p-2 shrink-0 transition-all border-b border-border/40">
                {/* Format Painter */}
                <Button
                  size="icon"
                  variant={isFormatPainterActive ? "secondary" : "ghost"}
                  className={cn(
                    "h-8 w-8 hover:bg-muted cursor-pointer rounded-lg transition-colors",
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

                <div className="h-4 w-[1px] bg-border mx-1" />

                {/* Bold */}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 hover:bg-muted cursor-pointer rounded-lg"
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
                  className="h-8 w-8 hover:bg-muted cursor-pointer rounded-lg"
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
                  className="h-8 w-8 hover:bg-muted cursor-pointer rounded-lg"
                  onMouseDown={e => {
                    e.preventDefault();
                    handleApplyStyle("underline");
                  }}
                  title="Underline (Ctrl+U)"
                >
                  <Underline className="h-4 w-4" />
                </Button>

                <div className="h-4 w-[1px] bg-border mx-1" />

                {/* Bullet list */}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 hover:bg-muted cursor-pointer rounded-lg"
                  onMouseDown={e => {
                    e.preventDefault();
                    handleApplyStyle("insertUnorderedList");
                  }}
                  title="Bullet List"
                >
                  <List className="h-4 w-4" />
                </Button>

                {/* Numbered list */}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 hover:bg-muted cursor-pointer rounded-lg"
                  onMouseDown={e => {
                    e.preventDefault();
                    handleApplyStyle("insertOrderedList");
                  }}
                  title="Numbered List"
                >
                  <ListOrdered className="h-4 w-4" />
                </Button>

                <div className="h-4 w-[1px] bg-border mx-1" />

                {/* Align Left */}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 hover:bg-muted cursor-pointer rounded-lg"
                  onMouseDown={e => {
                    e.preventDefault();
                    handleApplyStyle("justifyLeft");
                  }}
                  title="Align Left"
                >
                  <AlignLeft className="h-4 w-4" />
                </Button>

                {/* Align Center */}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 hover:bg-muted cursor-pointer rounded-lg"
                  onMouseDown={e => {
                    e.preventDefault();
                    handleApplyStyle("justifyCenter");
                  }}
                  title="Align Center"
                >
                  <AlignCenter className="h-4 w-4" />
                </Button>

                {/* Align Right */}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 hover:bg-muted cursor-pointer rounded-lg"
                  onMouseDown={e => {
                    e.preventDefault();
                    handleApplyStyle("justifyRight");
                  }}
                  title="Align Right"
                >
                  <AlignRight className="h-4 w-4" />
                </Button>

                <div className="h-4 w-[1px] bg-border mx-1" />

                {/* Table Insertion Popover */}
                <Popover open={tableInsertOpen} onOpenChange={setTableInsertOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 hover:bg-muted cursor-pointer rounded-lg"
                      onMouseDown={e => {
                        e.preventDefault();
                      }}
                      title="Insert table"
                    >
                      <Table2 className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[195px] p-2 bg-card border border-border/60 rounded-xl shadow-lg z-30" align="start">
                    <div className="text-[10px] font-semibold text-muted-foreground mb-2 text-center select-none">
                      {hoveredRow > 0 && hoveredCol > 0 ? `Insert ${hoveredRow} × ${hoveredCol} table` : "Select size"}
                    </div>
                    <div
                      className="grid grid-cols-8 gap-1 p-1 bg-muted/30 rounded-lg"
                      onMouseLeave={() => {
                        setHoveredRow(0);
                        setHoveredCol(0);
                      }}
                    >
                      {Array.from({ length: 64 }).map((_, index) => {
                        const r = Math.floor(index / 8) + 1;
                        const c = (index % 8) + 1;
                        const isHighlighted = r <= hoveredRow && c <= hoveredCol;
                        return (
                          <div
                            key={index}
                            className={cn(
                              "h-4 w-4 rounded-[3px] border border-border/70 cursor-pointer transition-all duration-100",
                              isHighlighted
                                ? "bg-primary border-primary shadow-sm"
                                : "bg-background hover:bg-muted/80"
                            )}
                            onMouseEnter={() => {
                              setHoveredRow(r);
                              setHoveredCol(c);
                            }}
                            onMouseDown={e => {
                              e.preventDefault();
                            }}
                            onClick={() => {
                              insertTable(r, c);
                              setTableInsertOpen(false);
                              setHoveredRow(0);
                              setHoveredCol(0);
                            }}
                          />
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>

                <div className="h-4 w-[1px] bg-border mx-1" />

                {/* Google Fonts selector dropdown */}
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
                  <SelectTrigger className="w-[125px] h-8 text-xs border border-border/50 cursor-pointer rounded-lg [&>span]:flex [&>span]:items-center [&>span]:gap-1.5">
                    <Type className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="truncate">{selectedFont}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {/* Sans-serif Fonts */}
                    <SelectItem value="Inter" className="text-xs font-sans cursor-pointer">Inter</SelectItem>
                    <SelectItem value="Roboto" className="text-xs font-sans cursor-pointer">Roboto</SelectItem>
                    <SelectItem value="Outfit" className="text-xs font-sans cursor-pointer">Outfit</SelectItem>
                    <SelectItem value="Poppins" className="text-xs font-sans cursor-pointer">Poppins</SelectItem>
                    <SelectItem value="Montserrat" className="text-xs font-sans cursor-pointer">Montserrat</SelectItem>
                    <SelectItem value="Open Sans" className="text-xs font-sans cursor-pointer">Open Sans</SelectItem>
                    <SelectItem value="Lato" className="text-xs font-sans cursor-pointer">Lato</SelectItem>
                    <SelectItem value="Josefin Sans" className="text-xs font-sans cursor-pointer">Josefin Sans</SelectItem>
                    <SelectItem value="Ubuntu" className="text-xs font-sans cursor-pointer">Ubuntu</SelectItem>
                    <SelectItem value="Nunito" className="text-xs font-sans cursor-pointer">Nunito</SelectItem>
                    <SelectItem value="Oswald" className="text-xs font-sans cursor-pointer" style={{ fontFamily: 'Oswald, sans-serif' }}>Oswald</SelectItem>

                    {/* Serif Fonts */}
                    <SelectItem value="Playfair Display" className="text-xs serif cursor-pointer" style={{ fontFamily: 'Playfair Display, serif' }}>Playfair Display</SelectItem>
                    <SelectItem value="Lora" className="text-xs serif cursor-pointer" style={{ fontFamily: 'Lora, serif' }}>Lora</SelectItem>
                    <SelectItem value="Merriweather" className="text-xs serif cursor-pointer" style={{ fontFamily: 'Merriweather, serif' }}>Merriweather</SelectItem>
                    <SelectItem value="Cinzel" className="text-xs serif cursor-pointer" style={{ fontFamily: 'Cinzel, serif' }}>Cinzel</SelectItem>

                    {/* Monospace Fonts */}
                    <SelectItem value="Fira Code" className="text-xs monospace cursor-pointer" style={{ fontFamily: 'Fira Code, monospace' }}>Fira Code</SelectItem>
                    <SelectItem value="Source Code Pro" className="text-xs monospace cursor-pointer" style={{ fontFamily: 'Source Code Pro, monospace' }}>Source Code Pro</SelectItem>

                    {/* Cursive / Creative Fonts */}
                    <SelectItem value="Pacifico" className="text-xs cursor-pointer" style={{ fontFamily: 'Pacifico, cursive' }}>Pacifico</SelectItem>
                    <SelectItem value="Dancing Script" className="text-xs cursor-pointer" style={{ fontFamily: 'Dancing Script, cursive' }}>Dancing Script</SelectItem>

                    {/* Bengali Fonts */}
                    <SelectItem value="Hind Siliguri" className="text-xs cursor-pointer" style={{ fontFamily: 'Hind Siliguri, sans-serif' }}>Hind Siliguri</SelectItem>
                    <SelectItem value="Baloo Da 2" className="text-xs cursor-pointer" style={{ fontFamily: 'Baloo Da 2, cursive' }}>Baloo Da 2</SelectItem>
                    <SelectItem value="Anek Bangla" className="text-xs cursor-pointer" style={{ fontFamily: 'Anek Bangla, sans-serif' }}>Anek Bangla</SelectItem>
                    <SelectItem value="Noto Sans Bengali" className="text-xs cursor-pointer" style={{ fontFamily: 'Noto Sans Bengali, sans-serif' }}>Noto Sans Bengali</SelectItem>
                    <SelectItem value="Noto Serif Bengali" className="text-xs cursor-pointer" style={{ fontFamily: 'Noto Serif Bengali, serif' }}>Noto Serif Bengali</SelectItem>
                  </SelectContent>
                </Select>

                {/* Font Size selector dropdown */}
                <Select
                  value={selectedFontSize}
                  onValueChange={v => {
                    setSelectedFontSize(v);
                    let attrVal = "3";
                    if (v === "12") attrVal = "1";
                    else if (v === "14") attrVal = "2";
                    else if (v === "16") attrVal = "3";
                    else if (v === "18") attrVal = "4";
                    else if (v === "24") attrVal = "5";
                    else if (v === "32") attrVal = "6";
                    else if (v === "48") attrVal = "7";
                    handleApplyFontSize(attrVal);
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
                  <SelectTrigger className="w-[85px] h-8 text-xs border border-border/50 cursor-pointer rounded-lg [&>span]:flex [&>span]:items-center [&>span]:gap-1 shrink-0 px-2">
                    <span className="truncate">{selectedFontSize} px</span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="12" className="text-xs cursor-pointer">12 px</SelectItem>
                    <SelectItem value="14" className="text-xs cursor-pointer">14 px</SelectItem>
                    <SelectItem value="16" className="text-xs cursor-pointer">16 px</SelectItem>
                    <SelectItem value="18" className="text-xs cursor-pointer">18 px</SelectItem>
                    <SelectItem value="24" className="text-xs cursor-pointer">24 px</SelectItem>
                    <SelectItem value="32" className="text-xs cursor-pointer">32 px</SelectItem>
                    <SelectItem value="48" className="text-xs cursor-pointer">48 px</SelectItem>
                  </SelectContent>
                </Select>

                {/* Text format selectors */}
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
                  <SelectTrigger className="w-[120px] h-8 text-xs border border-border/50 cursor-pointer rounded-lg">
                    <SelectValue placeholder="Text Format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="p" className="text-xs cursor-pointer">Paragraph</SelectItem>
                    <SelectItem value="h1" className="text-xs font-bold cursor-pointer">Heading 1</SelectItem>
                    <SelectItem value="h2" className="text-xs font-bold cursor-pointer">Heading 2</SelectItem>
                    <SelectItem value="h3" className="text-xs font-bold cursor-pointer">Heading 3</SelectItem>
                  </SelectContent>
                </Select>

                {/* Color picker */}
                <Select
                  value={selectedColor}
                  onValueChange={v => {
                    setSelectedColor(v);
                    handleApplyStyle("foreColor", v);
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
                  <SelectTrigger className="w-[115px] h-8 text-xs border border-border/50 cursor-pointer rounded-lg [&>span]:flex [&>span]:items-center [&>span]:gap-1.5">
                    <Palette
                      className="h-3.5 w-3.5 text-primary shrink-0 transition-colors"
                      style={{ color: selectedColor !== "#000000" ? selectedColor : undefined }}
                    />
                    <span className="truncate">
                      {selectedColor === "#000000" ? "Color" : (selectedColor === "#2563eb" ? "Blue" : (selectedColor === "#dc2626" ? "Red" : (selectedColor === "#16a34a" ? "Green" : (selectedColor === "#eab308" ? "Yellow" : (selectedColor === "#7c3aed" ? "Violet" : "Color")))))}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="#000000" className="text-xs text-black cursor-pointer">Default</SelectItem>
                    <SelectItem value="#2563eb" className="text-xs text-blue-600 font-semibold cursor-pointer">Blue</SelectItem>
                    <SelectItem value="#dc2626" className="text-xs text-red-600 font-semibold cursor-pointer">Red</SelectItem>
                    <SelectItem value="#16a34a" className="text-xs text-green-600 font-semibold cursor-pointer">Green</SelectItem>
                    <SelectItem value="#eab308" className="text-xs text-yellow-600 font-semibold cursor-pointer">Yellow</SelectItem>
                    <SelectItem value="#7c3aed" className="text-xs text-purple-600 font-semibold cursor-pointer">Violet</SelectItem>
                  </SelectContent>
                </Select>

                {isInsideTable && (
                  <>
                    <div className="h-4 w-[1px] bg-border mx-1" />

                    {/* Table Actions Dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 rounded-lg text-xs gap-1 cursor-pointer border border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 transition-colors"
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

                {/* Eraser */}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 hover:bg-muted text-destructive cursor-pointer rounded-lg ml-auto"
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
          <div className="flex-1 bg-background overflow-auto flex justify-center min-h-[500px] rounded-none md:rounded-b-3xl">
            <div
              ref={editorRef}
              contentEditable={currentNote.permission_level === "edit"}
              onInput={handleEditorInput}
              onMouseUp={handleEditorSelectionUpdate}
              onKeyUp={handleEditorSelectionUpdate}
              className="editor-content w-full max-w-[850px] min-h-[70vh] bg-background focus:outline-none text-slate-800 dark:text-slate-200 font-sans cursor-text px-6 md:px-12 py-8 transition-colors duration-200"
              style={{ outline: 'none' }}
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
                              <SelectTrigger className="w-full h-11 text-sm border border-border/60 cursor-pointer rounded-xl bg-background [&>span]:flex [&>span]:items-center [&>span]:gap-2 px-3.5">
                                <Type className="h-4 w-4 text-primary shrink-0" />
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
                                let attrVal = "3";
                                if (v === "12") attrVal = "1";
                                else if (v === "14") attrVal = "2";
                                else if (v === "16") attrVal = "3";
                                else if (v === "18") attrVal = "4";
                                else if (v === "24") attrVal = "5";
                                else if (v === "32") attrVal = "6";
                                else if (v === "48") attrVal = "7";
                                handleApplyFontSize(attrVal);
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
                              <SelectContent>
                                <SelectItem value="12" className="text-sm cursor-pointer">12 px</SelectItem>
                                <SelectItem value="14" className="text-sm cursor-pointer">14 px</SelectItem>
                                <SelectItem value="16" className="text-sm cursor-pointer">16 px (Default)</SelectItem>
                                <SelectItem value="18" className="text-sm cursor-pointer">18 px</SelectItem>
                                <SelectItem value="24" className="text-sm cursor-pointer">24 px</SelectItem>
                                <SelectItem value="32" className="text-sm cursor-pointer">32 px</SelectItem>
                                <SelectItem value="48" className="text-sm cursor-pointer">48 px</SelectItem>
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
                            <div className="grid grid-cols-3 gap-2">
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
      )}

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
                      {f.name}
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
}

function NotesGrid({ notesList, handleOpenEditor, handleDeleteDocument, isAdmin, activeStaff, profileId, foldersList }: NotesGridProps) {
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
            {/* Card Top Row: File icon and Delete button */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileText className="h-4.5 w-4.5" />
              </div>

              {(isOwned || isAdmin) && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent opening the editor
                    handleDeleteDocument(n.id, n.title);
                  }}
                  className="h-7 w-7 text-destructive hover:bg-destructive/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 cursor-pointer shrink-0"
                  title="Delete Document"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
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
                  <span className="truncate font-semibold">
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


