import { useState, useEffect, useRef } from "react";
import Markdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import {
  MessageSquare,
  Plus,
  Trash2,
  Edit,
  Check,
  X,
  Menu,
  Globe,
  Sparkles,
  Code,
  PenTool,
  GraduationCap,
  Send,
  Copy,
  RotateCcw,
  Compass,
  Settings,
  ExternalLink,
  Bot,
  User,
  ArrowRight,
  Search,
  KeyRound,
  Terminal,
  LogOut,
  QrCode,
  Smartphone,
  ShieldCheck,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Camera,
  Image,
  Calculator,
  Atom,
  Dna,
} from "lucide-react";
import {
  auth,
  db,
  logInWithGoogle,
  logOut,
  OperationType,
  handleFirestoreError,
} from "./firebase";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import {
   Conversation,
   Message,
   PRESET_INSTRUCTIONS,
   SystemPreset,
} from "./types";

// Custom, highly polished Red Ladybug icon component
function Ladybug({ className = "h-6 w-6", strokeWidth = 2 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Legs of the ladybug */}
      <path d="M6 10c-1.5 0-2.5-.5-3.5-1.5" />
      <path d="M5 14H2" />
      <path d="M6 18c-1.5 0-2.5.5-3.5 1.5" />
      <path d="M18 10c1.5 0 2.5-.5 3.5-1.5" />
      <path d="M19 14h3" />
      <path d="M18 18c1.5 0 2.5.5 3.5 1.5" />

      {/* Head */}
      <path d="M12 6a3.5 3.5 0 0 0-3-3.5h6A3.5 3.5 0 0 0 12 6z" fill="currentColor" />
      
      {/* Antennas */}
      <path d="M10 2.5C10 1.5 9 1 9 1" />
      <path d="M14 2.5C14 1.5 15 1 15 1" strokeWidth={1.5} />

      {/* Main wings shell (split circle) */}
      <circle cx="12" cy="14" r="7" fill="#ef4444" stroke="currentColor" />
      
      {/* Vertical line split wings */}
      <line x1="12" y1="7" x2="12" y2="21" stroke="currentColor" />
      
      {/* Spots on wings */}
      <circle cx="9.5" cy="11.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="8.5" cy="15" r="1" fill="currentColor" stroke="none" />
      <circle cx="10.5" cy="18" r="0.8" fill="currentColor" stroke="none" />
      
      <circle cx="14.5" cy="11.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="15" r="1" fill="currentColor" stroke="none" />
      <circle cx="13.5" cy="18" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Custom, highly polished vertical three dots icon
function MoreVertical({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <circle cx="12" cy="5" r="1" fill="currentColor" />
      <circle cx="12" cy="19" r="1" fill="currentColor" />
    </svg>
  );
}

export default function App() {
  // Authentication State
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Conversations Catalog (Representing either Remote SQL cloud threads or fallback LocalStorage data)
  const [conversations, setConversations] = useState<Conversation[]>([]);
  
  // Active Messages of the currently selected conversation
  const [activeMessages, setActiveMessages] = useState<Message[]>([]);

  // Active Thread ID
  const [activeId, setActiveId] = useState<string | null>(null);

  // Form parameters
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [systemInstruction, setSystemInstruction] = useState(
    PRESET_INSTRUCTIONS[0].instruction
  );
  const [useSearch, setUseSearch] = useState(false);
  const [selectedModel, setSelectedModel] = useState("gemini-3.5-flash");

  // Interaction controls
  const [searchQuery, setSearchQuery] = useState("");
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editTitleInput, setEditTitleInput] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [backendConfigured, setBackendConfigured] = useState<boolean | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [authError, setAuthError] = useState<{ code: string; message: string; domain?: string } | null>(null);
  const [showKeyHelpModal, setShowKeyHelpModal] = useState(false);

  // Active URLs for mobile sync
  const [remoteUrl, setRemoteUrl] = useState("");

  // States for Voice / Speech Features
  const [isListening, setIsListening] = useState(false);
  const [currentlyReadingId, setCurrentlyReadingId] = useState<string | null>(null);

  // States for Camera & Image Attachments
  const [attachedImage, setAttachedImage] = useState<{ base64: string; type: string; name: string } | null>(null);
  const [showCameraViewfinder, setShowCameraViewfinder] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showMoreActions, setShowMoreActions] = useState(false);

  // Refs for Camera Streaming
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Refs
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Message long-press and editing states
  const [activeMenuMsgId, setActiveMenuMsgId] = useState<string | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editMsgInput, setEditMsgInput] = useState("");

  const longPressTimeoutRef = useRef<any>(null);
  const touchStartedRef = useRef<boolean>(false);

  const startLongPress = (msgId: string, text: string) => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
    }
    touchStartedRef.current = true;
    longPressTimeoutRef.current = setTimeout(() => {
      setActiveMenuMsgId(msgId);
      setEditMsgInput(text);
    }, 600);
  };

  const cancelLongPress = () => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
    touchStartedRef.current = false;
  };

  const handleEditMessageSave = async (msgId: string) => {
    if (!activeId) return;
    const cleanText = editMsgInput.trim();
    if (!cleanText) return;

    // Local instant state change
    setActiveMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, parts: cleanText } : m))
    );

    if (!user) {
      // Offline Flow
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === activeId) {
            return {
              ...c,
              messages: c.messages.map((m) =>
                m.id === msgId ? { ...m, parts: cleanText } : m
              ),
            };
          }
          return c;
        })
      );
    } else {
      // Cloud Flow
      try {
        const msgRef = doc(db, "conversations", activeId, "messages", msgId);
        await updateDoc(msgRef, { parts: cleanText });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `conversations/${activeId}/messages/${msgId}`);
      }
    }

    setEditingMsgId(null);
    setActiveMenuMsgId(null);
  };

  // Dynamic time-based greeting (Bonjour or Bonsoir)
  const currentHour = new Date().getHours();
  const greeting = currentHour >= 18 || currentHour < 5 ? "Bonsoir" : "Bonjour";

  // Detect server status and dynamic URLs
  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => {
        setBackendConfigured(data.apiKeyConfigured);
      })
      .catch((err) => {
        console.error("Health check failure:", err);
        setBackendConfigured(false);
      });

    // Detect active origin URL
    if (typeof window !== "undefined") {
      setRemoteUrl(window.location.origin);
    }
  }, []);

  // Monitor Auth Changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);
      
      if (currentUser) {
        // Logged in: Let's read selected active id if any
        const savedActive = localStorage.getItem(`chat_active_id_${currentUser.uid}`);
        setActiveId(savedActive || null);
      } else {
        // Logged out: Restore local active id
        const savedActive = localStorage.getItem("chat_active_id_anon");
        setActiveId(savedActive || null);
      }
    });
    return unsubscribe;
  }, []);

  // Sync Conversations Registry (Local vs Cloud depending on Auth State)
  useEffect(() => {
    if (isAuthLoading) return;

    if (!user) {
      // Offline/Anon Flow: Load from localStorage
      const saved = localStorage.getItem("chat_conversations_anon");
      const list = saved ? JSON.parse(saved) : [];
      setConversations(list);
      return;
    }

    // Cloud Flow: Subscribe to user conversations on Firestore
    const q = query(
      collection(db, "conversations"),
      where("userId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const cloudConversations = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            title: data.title,
            messages: [], // To protect overhead, we load active messages sequentially in another hook
            systemInstruction: data.systemInstruction,
            useSearch: data.useSearch,
            modelName: data.modelName,
            createdAt: data.createdAt,
          } as Conversation;
        });

        // Sort by thread timestamp descending
        cloudConversations.sort((a, b) => Number(b.id) - Number(a.id));
        setConversations(cloudConversations);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, "conversations");
      }
    );

    return unsubscribe;
  }, [user, isAuthLoading]);

  // Sync Active Messages of the selected conversation
  useEffect(() => {
    if (isAuthLoading) return;

    if (!activeId) {
      setActiveMessages([]);
      return;
    }

    // Capture configs matching active conversation
    const activeConvo = conversations.find((c) => c.id === activeId);
    if (activeConvo) {
      setSystemInstruction(activeConvo.systemInstruction || PRESET_INSTRUCTIONS[0].instruction);
      setUseSearch(!!activeConvo.useSearch);
      setSelectedModel(activeConvo.modelName || "gemini-3.5-flash");
    }

    // Save active id persistence
    if (user) {
      localStorage.setItem(`chat_active_id_${user.uid}`, activeId);
    } else {
      localStorage.setItem("chat_active_id_anon", activeId);
    }

    if (!user) {
      // Offline Flow: Retrieve messages directly from local cache structures
      const convo = conversations.find((c) => c.id === activeId);
      setActiveMessages(convo ? convo.messages : []);
      return;
    }

    // Cloud Flow: Subscribe to subcollection "/conversations/{convoId}/messages" sorted by id/timestamp
    const msgColRef = collection(db, "conversations", activeId, "messages");
    
    const unsubscribe = onSnapshot(
      msgColRef,
      (snapshot) => {
        const cloudMsgs = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            role: data.role,
            parts: data.parts,
            timestamp: data.timestamp,
            sources: data.sources,
          } as Message;
        });

        // Ensure chronological message flow sorting by document string ID
        cloudMsgs.sort((a, b) => Number(a.id) - Number(b.id));
        setActiveMessages(cloudMsgs);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, `conversations/${activeId}/messages`);
      }
    );

    return unsubscribe;
  }, [activeId, user, conversations.length, isAuthLoading]);

  // Save changes to LocalStorage only if user is logged out (preserves system boundaries)
  useEffect(() => {
    if (!user && !isAuthLoading && conversations.length > 0) {
      localStorage.setItem("chat_conversations_anon", JSON.stringify(conversations));
    }
  }, [conversations, user, isAuthLoading]);

  // Scroll downwards on changes
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages, activeId, isStreaming]);

  // Authenticate user flow
  const handleGoogleSignIn = async () => {
    try {
      setAuthError(null);
      await logInWithGoogle();
    } catch (err: any) {
      console.error("Sign-in trigger failure:", err);
      const errCode = err?.code || "";
      const errMsg = err?.message || String(err);
      setAuthError({
        code: errCode,
        message: errMsg,
        domain: typeof window !== "undefined" ? window.location.origin : undefined,
      });
    }
  };

  const handleSignOut = async () => {
    try {
      await logOut();
      setActiveId(null);
      setActiveMessages([]);
    } catch (err) {
      console.error("Sign-out trigger failure:", err);
    }
  };

  // Create thread action
  const createNewChat = async (initialPreset?: SystemPreset, firstMessageText?: string) => {
    const id = Date.now().toString();
    const preset = initialPreset || PRESET_INSTRUCTIONS[0];
    
    const newChat: Conversation = {
      id,
      title: firstMessageText 
        ? firstMessageText.substring(0, 30) + (firstMessageText.length > 30 ? "..." : "")
        : "Nouvelle discussion",
      messages: [],
      systemInstruction: preset.instruction,
      useSearch: false,
      modelName: "gemini-3.5-flash",
      createdAt: new Date().toLocaleDateString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    if (!user) {
      // Local setup
      setConversations((prev) => [newChat, ...prev]);
      setActiveId(id);
      if (firstMessageText) {
        setTimeout(() => {
          sendDirectMessage(id, firstMessageText, preset.instruction, false, "gemini-3.5-flash");
        }, 60);
      }
    } else {
      // Cloud setup - Write Metadata to Firestore first
      try {
        const convoRef = doc(db, "conversations", id);
        await setDoc(convoRef, {
          id,
          title: newChat.title,
          userId: user.uid,
          systemInstruction: preset.instruction,
          useSearch: false,
          modelName: "gemini-3.5-flash",
          createdAt: newChat.createdAt,
        });

        // Set active immediately
        setActiveId(id);

        if (firstMessageText) {
          setTimeout(() => {
            sendDirectMessage(id, firstMessageText, preset.instruction, false, "gemini-3.5-flash");
          }, 60);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `conversations/${id}`);
      }
    }

    setTimeout(() => {
      inputRef.current?.focus();
    }, 120);
  };

  // Delete thread action
  const deleteChat = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!user) {
      // Local
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeId === id) {
        const remaining = conversations.filter((c) => c.id !== id);
        setActiveId(remaining.length > 0 ? remaining[0].id : null);
      }
    } else {
      // Remote
      try {
        const convoRef = doc(db, "conversations", id);
        await deleteDoc(convoRef);
        if (activeId === id) {
          setActiveId(null);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `conversations/${id}`);
      }
    }
  };

  // Edit and Save Title
  const startEditingTitle = (id: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTitleId(id);
    setEditTitleInput(currentTitle);
  };

  const saveTitleEdit = async (id: string, e?: React.FormEvent) => {
    e?.preventDefault();
    const cleanTitle = editTitleInput.trim();
    if (!cleanTitle) {
      setEditingTitleId(null);
      return;
    }

    if (!user) {
      // Local
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: cleanTitle } : c))
      );
    } else {
      // Remote
      try {
        const convoRef = doc(db, "conversations", id);
        await updateDoc(convoRef, { title: cleanTitle });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `conversations/${id}`);
      }
    }
    setEditingTitleId(null);
  };

  // Bulk update params on active session
  const updateActiveConfig = async (updates: Partial<Conversation>) => {
    if (!activeId) return;

    if (!user) {
      // Local
      setConversations((prev) =>
        prev.map((c) => (c.id === activeId ? { ...c, ...updates } : c))
      );
    } else {
      // Remote
      try {
        const convoRef = doc(db, "conversations", activeId);
        await updateDoc(convoRef, updates);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `conversations/${activeId}`);
      }
    }
  };

  // --- SYNC SPEECH & CAPTURE UTILITIES ---

  // TTS: Play Message Aloud using Synthesis
  const playMessageTextAloud = (text: string, msgId: string) => {
    if (!("speechSynthesis" in window)) {
      alert("La synthèse vocale n'est pas prise en charge par votre navigateur.");
      return;
    }

    if (currentlyReadingId === msgId) {
      window.speechSynthesis.cancel();
      setCurrentlyReadingId(null);
      return;
    }

    // Stop former audios
    window.speechSynthesis.cancel();

    // Clean text from markdown bold, lists, and links before reading
    const cleanText = text
      .replace(/[*#_`~>\[\]]/g, "") // remove basic markdown syntax
      .replace(/\s+/g, " ")
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = "fr-FR";

    utterance.onend = () => {
      setCurrentlyReadingId(null);
    };

    utterance.onerror = () => {
      setCurrentlyReadingId(null);
    };

    setCurrentlyReadingId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  // STT: Speech to Text (Microphone voice input)
  const toggleSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      alert("La reconnaissance vocale n'est pas supportée par votre navigateur (Recommandé: Google Chrome).");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "fr-FR";

    rec.onstart = () => {
      setIsListening(true);
    };

    rec.onresult = (event: any) => {
      const resultText = event.results[0][0].transcript;
      if (resultText) {
        setInput((prev) => (prev ? `${prev} ${resultText}` : resultText));
      }
    };

    rec.onerror = (err: any) => {
      console.error("Speech Recognition Error:", err);
      setIsListening(false);
    };

    rec.onend = () => {
      setIsListening(false);
    };

    rec.start();
  };

  // CAMERA: Start device camera streaming
  const startCameraStream = async () => {
    setCameraError(null);
    setShowCameraViewfinder(true);

    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch((err) => console.error("Video play error:", err));
      }
    } catch (err: any) {
      console.error("Camera stream error:", err);
      setCameraError("Impossible d'accéder à l'appareil photo. Veuillez autoriser la caméra dans votre navigateur.");
    }
  };

  // CAMERA: Stop device camera stream
  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setShowCameraViewfinder(false);
  };

  // CAMERA: Snap photo from stream
  const capturePhoto = () => {
    if (!videoRef.current) return;

    try {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      const context = canvas.getContext("2d");
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        const base64Clean = dataUrl.split(",")[1];
        
        setAttachedImage({
          base64: base64Clean,
          type: "image/jpeg",
          name: `capture_${Date.now()}.jpg`,
        });
      }
      stopCameraStream();
    } catch (err) {
      console.error("Canvas snap error:", err);
    }
  };

  // GALLERY: Pick files from local album/gallery
  const handleGalleryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Veuillez sélectionner uniquement des fichiers images.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64Clean = result.split(",")[1];
      
      setAttachedImage({
        base64: base64Clean,
        type: file.type,
        name: file.name,
      });
    };
    reader.onerror = () => {
      alert("Une erreur s'est produite lors du chargement de l'image.");
    };
    reader.readAsDataURL(file);
    e.target.value = ""; // reset input target
  };

  // Effect cleanups on unmount
  useEffect(() => {
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Form handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !attachedImage) || isStreaming) return;

    const currentInput = input.trim();
    setInput("");

    // If text is blank but an image is attached, provide a default human-like context prompt
    const promptText = currentInput || "Décris cette image en détail s'il te plaît ou réponds à ma demande.";

    let chatId = activeId;
    if (!chatId) {
      // If none active, build thread cascaded
      const id = Date.now().toString();
      const newTitle = promptText.substring(0, 30) + (promptText.length > 30 ? "..." : "");
      
      if (!user) {
        const newChat: Conversation = {
          id,
          title: newTitle,
          messages: [],
          systemInstruction,
          useSearch,
          modelName: selectedModel,
          createdAt: new Date().toLocaleDateString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        };
        setConversations((prev) => [newChat, ...prev]);
        setActiveId(id);
        setTimeout(() => {
          sendDirectMessage(id, promptText, systemInstruction, useSearch, selectedModel);
        }, 60);
      } else {
        try {
          const convoRef = doc(db, "conversations", id);
          await setDoc(convoRef, {
            id,
            title: newTitle,
            userId: user.uid,
            systemInstruction,
            useSearch,
            modelName: selectedModel,
            createdAt: new Date().toLocaleDateString("fr-FR", {
              hour: "2-digit",
              minute: "2-digit",
            }),
          });
          setActiveId(id);
          setTimeout(() => {
            sendDirectMessage(id, promptText, systemInstruction, useSearch, selectedModel);
          }, 60);
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `conversations/${id}`);
        }
      }
    } else {
      await sendDirectMessage(chatId, promptText, systemInstruction, useSearch, selectedModel);
    }
  };

  // SSE Chat stream executor
  const sendDirectMessage = async (
    chatId: string,
    messageText: string,
    sysInstruction: string,
    searchActive: boolean,
    modelName: string
  ) => {
    // Collect current attachment if any, and reset state immediately for responsiveness
    const currentAttachmentUrl = attachedImage ? `data:${attachedImage.type};base64,${attachedImage.base64}` : undefined;
    setAttachedImage(null);

    // 1. Create User Message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      parts: messageText,
      timestamp: new Date().toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      imageUrl: currentAttachmentUrl,
    };

    // Append user message local representation first
    if (!user) {
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === chatId) {
            const isFirst = c.messages.length === 0;
            return {
              ...c,
              title: isFirst
                ? messageText.substring(0, 40) + (messageText.length > 40 ? "..." : "")
                : c.title,
              messages: [...c.messages, userMessage],
            };
          }
          return c;
        })
      );
      setActiveMessages((prev) => [...prev, userMessage]);
    } else {
      // Cloud Write: Push user message inside messages subcollection
      try {
        const msgRef = doc(db, "conversations", chatId, "messages", userMessage.id);
        const fbMessageData: any = {
          id: userMessage.id,
          role: userMessage.role,
          parts: userMessage.parts,
          timestamp: userMessage.timestamp,
        };
        if (userMessage.imageUrl) {
          fbMessageData.imageUrl = userMessage.imageUrl;
        }
        await setDoc(msgRef, fbMessageData);

        // If it was the first message in the thread, update conversation title in Firestore
        const activeConvo = conversations.find((c) => c.id === chatId);
        if (activeConvo && activeConvo.title === "Nouvelle discussion") {
          const mainRef = doc(db, "conversations", chatId);
          await updateDoc(mainRef, {
            title: messageText.substring(0, 40) + (messageText.length > 40 ? "..." : ""),
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `conversations/${chatId}/messages/${userMessage.id}`);
      }
    }

    setIsStreaming(true);

    // 2. Prepare AI Message Placeholder
    const assistantMessageId = (Date.now() + 1).toString();
    const assistantPlaceholder: Message = {
      id: assistantMessageId,
      role: "model",
      parts: "",
      timestamp: new Date().toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    if (!user) {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === chatId
            ? { ...c, messages: [...c.messages, assistantPlaceholder] }
            : c
        )
      );
      setActiveMessages((prev) => [...prev, assistantPlaceholder]);
    } else {
      // Write placeholder in cloud
      try {
        const modelMsgRef = doc(db, "conversations", chatId, "messages", assistantMessageId);
        await setDoc(modelMsgRef, {
          id: assistantMessageId,
          role: "model",
          parts: "",
          timestamp: assistantPlaceholder.timestamp,
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `conversations/${chatId}/messages/${assistantMessageId}`);
      }
    }

    try {
      // Collect history
      let currentConvoHistory: Message[] = [];
      if (!user) {
        const activeC = conversations.find((c) => c.id === chatId);
        currentConvoHistory = activeC ? activeC.messages : [];
      } else {
        // Use current read messages state
        currentConvoHistory = activeMessages;
      }

      // Map dialogue list to part format
      const payloadMessages = [
        ...currentConvoHistory.map((m) => {
          const parts: any[] = [{ text: m.parts || "" }];
          if (m.imageUrl) {
            try {
              const mimeType = m.imageUrl.split(";")[0].split(":")[1];
              const base64Data = m.imageUrl.split("base64,")[1];
              parts.push({
                inlineData: {
                  mimeType,
                  data: base64Data,
                }
              });
            } catch (imageParseErr) {
              console.error("Failed to parse historic image:", imageParseErr);
            }
          }
          return {
            role: m.role || "user",
            parts,
          };
        }),
        // Map active prompt
        (() => {
          const parts: any[] = [{ text: messageText }];
          if (currentAttachmentUrl) {
            try {
              const mimeType = currentAttachmentUrl.split(";")[0].split(":")[1];
              const base64Data = currentAttachmentUrl.split("base64,")[1];
              parts.push({
                inlineData: {
                  mimeType,
                  data: base64Data,
                }
              });
            } catch (imageParseErr) {
              console.error("Failed to parse current image:", imageParseErr);
            }
          }
          return {
            role: "user",
            parts,
          };
        })()
      ];

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: payloadMessages,
          systemInstruction: sysInstruction,
          useSearch: searchActive,
          modelName,
        }),
      });

      if (!response.body) {
        throw new Error("Impossible d'initier le stream réseau.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let finished = false;
      let streamedText = "";
      let groundingSources: any[] = [];

      while (!finished) {
        const { value, done } = await reader.read();
        finished = done;
        if (value) {
          const chunkStr = decoder.decode(value);
          const lines = chunkStr.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const dataStr = line.slice(6).trim();
              if (dataStr === "[DONE]") {
                finished = true;
                break;
              }

              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.error) {
                  streamedText = `⚠️ Erreur de l'API Gemini : ${parsed.error}`;
                  finished = true;
                  break;
                }
                if (parsed.text) {
                  streamedText += parsed.text;
                }
                if (parsed.sources && parsed.sources.length > 0) {
                  groundingSources = parsed.sources;
                }

                // Update active representation on the fly
                if (!user) {
                  // Local state edit
                  setConversations((prev) =>
                    prev.map((c) => {
                      if (c.id === chatId) {
                        return {
                          ...c,
                          messages: c.messages.map((m) =>
                            m.id === assistantMessageId
                              ? { ...m, parts: streamedText, sources: groundingSources.length ? groundingSources : m.sources }
                              : m
                          ),
                        };
                      }
                      return c;
                    })
                  );
                  setActiveMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMessageId
                        ? { ...m, parts: streamedText, sources: groundingSources.length ? groundingSources : m.sources }
                        : m
                    )
                  );
                } else {
                  // Direct remote live representation update
                  const modelMsgDocRef = doc(db, "conversations", chatId, "messages", assistantMessageId);
                  const updatePayload: any = { parts: streamedText };
                  if (groundingSources.length > 0) {
                    updatePayload.sources = groundingSources;
                  }
                  await updateDoc(modelMsgDocRef, updatePayload);
                }
              } catch (e) {
                // partial chunk parsing error skipped
              }
            }
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      const errorMsg = `⚠️ Échec système : ${err.message || "Erreur indéterminée"}`;
      
      if (!user) {
        setActiveMessages((prev) =>
          prev.map((m) => (m.id === assistantMessageId ? { ...m, parts: errorMsg } : m))
        );
      } else {
        try {
          const modelMsgDocRef = doc(db, "conversations", chatId, "messages", assistantMessageId);
          await updateDoc(modelMsgDocRef, { parts: errorMsg });
        } catch (dbErr) {
          console.error("Firestore message write failed:", dbErr);
        }
      }
    } finally {
      setIsStreaming(false);
    }
  };

  // Local helper copy action
  const copyMessageText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(id);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  // Quick prompt cards
  const quickPrompts = [
    { title: "Développer une API", text: "Propose une maquette d'API Node.js/Express minimale pour gérer un inventaire de livres." },
    { title: "Rédiger des excuses respectueuses", text: "Formule une réponse écrite concise pour annuler poliment un rendez-vous à la dernière minute." },
    { title: "Résumer un cours complexe", text: "Donne un résumé explicatif frappant sur le fonctionnement des trous noirs spatiaux." },
    { title: "Idées de repas rapides", text: "Suggère 5 recettes originales de dîners sains prêts à être servis en moins de 15 minutes." },
  ];

  // Filtering conversation list match
  const filteredHistory = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div id="app-root" className="flex h-screen w-screen overflow-hidden bg-zinc-950 font-sans text-zinc-100">
      
      {/* Collapsible & Scrollable Sidebar holding previous conversations */}
      <aside
        id="sidebar"
        style={{ width: isSidebarOpen ? "288px" : "0px", minWidth: isSidebarOpen ? "288px" : "0px" }}
        className={`relative inset-y-0 left-0 z-40 flex flex-col border-r border-zinc-800 bg-zinc-900 transition-all duration-300 md:static overflow-hidden`}
      >
        <div className="flex flex-col h-full w-72 shrink-0">
          
          {/* Sidebar Header */}
          <div id="sidebar-header" className="flex items-center justify-between p-4 pb-2">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-red-500 to-red-700 text-zinc-950 font-display shadow-md">
                <Ladybug className="h-4.5 w-4.5 text-zinc-950" strokeWidth={2.5} />
              </span>
              <div className="leading-tight">
                <h1 className="font-display font-semibold text-zinc-100 text-sm">Anicetgdn AI</h1>
                <p className="text-[10px] text-emerald-400 font-mono tracking-wider uppercase">MODÈLE ACTIF</p>
              </div>
            </div>
            <button
              id="close-sidebar-btn"
              onClick={() => setIsSidebarOpen(false)}
              className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              title="Fermer l'historique"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* New Discussion Trigger Action */}
          <div className="p-4">
            <button
              id="new-chat-btn"
              onClick={() => createNewChat()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 py-3 px-4 text-sm font-semibold text-zinc-100 shadow-sm transition-all hover:bg-zinc-700 hover:border-zinc-600 active:scale-95 cursor-pointer"
            >
              <Plus className="h-4 w-4 text-emerald-400" />
              Nouvelle discussion
            </button>
          </div>

          {/* Persistent History Sync Widget */}
          <div className="px-4 pb-3">
            {!user ? (
              <div className="rounded-xl bg-purple-950/40 border border-purple-800/40 p-3 text-center space-y-2">
                <p className="text-[10px] leading-relaxed text-purple-300">
                  ⚠️ Discussions locales temporaires. Connectez votre compte Google pour sauvegarder votre historique dans le cloud !
                </p>
                <button
                  id="google-login-sidebar-btn"
                  onClick={handleGoogleSignIn}
                  className="w-full rounded-lg bg-purple-600 py-1.5 px-3 text-[11px] font-bold text-white hover:bg-purple-500 transition-colors active:scale-95 cursor-pointer"
                >
                  Se connecter avec Google
                </button>
              </div>
            ) : (
              <div className="rounded-xl bg-emerald-950/20 border border-emerald-900/30 p-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-6 w-6 rounded-full bg-emerald-600 text-[10px] font-bold text-white flex items-center justify-center shrink-0">
                    {user.displayName ? user.displayName[0].toUpperCase() : "G"}
                  </div>
                  <span className="text-[10px] text-emerald-300 truncate font-semibold" title={user.email || ""}>
                    {user.displayName || "Connecté Google"}
                  </span>
                </div>
                <button
                  id="google-logout-sidebar-btn"
                  onClick={handleSignOut}
                  className="text-zinc-500 hover:text-red-400 p-1 rounded"
                  title="Se déconnecter"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* History Search Textbox */}
          <div className="px-4 pb-2">
            <div className="relative flex items-center">
              <Search className="absolute left-3 h-4 w-4 text-zinc-500" />
              <input
                id="search-input"
                type="text"
                placeholder="Rechercher discussion..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg bg-zinc-950 py-1.5 pl-9 pr-4 text-xs text-zinc-200 placeholder-zinc-500 border border-zinc-800 focus:outline-none focus:border-zinc-700"
              />
              {searchQuery && (
                <button
                  id="clear-search-btn"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 text-zinc-400 hover:text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* Threads History Container block */}
          <div id="history-container" className="flex-1 overflow-y-auto px-2 py-1 space-y-1">
            {filteredHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-6 text-center">
                <span className="text-zinc-600 text-xs mt-2">Aucun historique de discussion</span>
              </div>
            ) : (
              filteredHistory.map((convo) => {
                const isActive = convo.id === activeId;
                const isEditing = convo.id === editingTitleId;

                return (
                  <div
                    id={`chat-item-${convo.id}`}
                    key={convo.id}
                    onClick={() => setActiveId(convo.id)}
                    className={`group relative flex items-center justify-between rounded-lg p-3 text-sm cursor-pointer transition-all ${
                      isActive
                        ? "bg-zinc-800 border-l-4 border-emerald-500 text-white"
                        : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                    }`}
                  >
                    <div className="flex flex-1 items-center gap-2 min-w-0 pr-6">
                      <MessageSquare className={`h-4 w-4 shrink-0 ${isActive ? "text-emerald-400" : "text-zinc-500"}`} />
                      
                      {isEditing ? (
                        <form
                          onSubmit={(e) => saveTitleEdit(convo.id, e)}
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 min-w-0"
                        >
                          <input
                            id={`edit-title-input-${convo.id}`}
                            type="text"
                            value={editTitleInput}
                            onChange={(e) => setEditTitleInput(e.target.value)}
                            onBlur={() => saveTitleEdit(convo.id)}
                            autoFocus
                            className="w-full bg-zinc-950 px-1 border border-emerald-500 rounded text-xs text-white focus:outline-none"
                          />
                        </form>
                      ) : (
                        <div className="truncate leading-tight flex-1">
                          <span className="font-medium text-xs block truncate">{convo.title}</span>
                          <span className="block text-[9px] text-zinc-500 mt-0.5">{convo.createdAt}</span>
                        </div>
                      )}
                    </div>

                    {/* Actions on hover */}
                    {!isEditing && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-l from-zinc-900 md:from-zinc-800 pl-4">
                        <button
                          id={`edit-title-btn-${convo.id}`}
                          onClick={(e) => startEditingTitle(convo.id, convo.title, e)}
                          className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-700"
                          title="Renommer la discussion"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button
                          id={`delete-chat-btn-${convo.id}`}
                          onClick={(e) => deleteChat(convo.id, e)}
                          className="p-1 rounded text-zinc-400 hover:text-red-400 hover:bg-zinc-700"
                          title="Supprimer la discussion"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Sidebar Footer */}
          <div id="sidebar-footer" className="border-t border-zinc-800 bg-zinc-950 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-800 font-display text-sm font-bold text-emerald-400 border border-zinc-700">
                A
              </span>
              <div className="truncate leading-tight">
                <span className="block text-xs font-semibold text-zinc-200">Anicetgdn AI</span>
                <span className="block text-[9px] text-zinc-400 mt-0.5">Propulsé par Google Gemini</span>
              </div>
            </div>

            <button
              id="network-status-btn"
              type="button"
              onClick={() => setShowKeyHelpModal(true)}
              className="w-full flex items-center justify-between text-[11px] text-zinc-500 hover:text-zinc-300 p-1.5 rounded-lg border border-transparent hover:border-zinc-800 hover:bg-zinc-900 transition-all text-left cursor-pointer"
              title="Cliquer pour configurer la clé d'API"
            >
              <div className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${backendConfigured ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
                <span>Statut Réseau</span>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${backendConfigured ? "text-emerald-400 bg-emerald-950/40" : "text-yellow-400 bg-yellow-950/30 font-bold"}`}>
                {backendConfigured ? "En ligne" : "Configurer ⚠️"}
              </span>
            </button>
          </div>

        </div>
      </aside>

      {/* Main Workspace Frame container */}
      <main id="main-content" className="flex-1 flex flex-col min-w-0 bg-zinc-950 relative">
        
        {/* Appbar */}
        <header id="appbar" className="h-14 shrink-0 flex items-center justify-between px-4 border-b border-zinc-800/80 bg-zinc-900/40 backdrop-blur-md sticky top-0 z-10 w-full">
          <div className="flex items-center gap-3">
            {!isSidebarOpen && (
              <button
                id="sidebar-toggle-btn"
                onClick={() => setIsSidebarOpen(true)}
                className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-850 hover:text-white cursor-pointer"
                title="Dérouler l'historique"
              >
                <Menu className="h-5 w-5" />
              </button>
            )}
            <div className="leading-normal">
              <h2 className="text-xs sm:text-sm font-semibold text-zinc-100 flex items-center gap-1.5 min-w-0">
                <span className="truncate max-w-[10rem] sm:max-w-[18rem] text-zinc-300">
                  {activeId ? (conversations.find((c) => c.id === activeId)?.title || "Discussion active") : "Nouvelle session"}
                </span>
              </h2>
            </div>
          </div>

          {/* Header controls layout (removed Lien Mobile, Recherche Web, and Changer Rôle) */}
          <div className="flex items-center gap-2 text-xs">
          </div>
        </header>

        {/* Roles floating selection bar */}
        {showSettings && (
          <div id="settings-panel" className="absolute top-14 left-0 right-0 z-20 border-b border-zinc-800 bg-zinc-900/95 p-4 backdrop-blur-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <Terminal className="h-4 w-4 text-purple-400" />
                  Rôles d'Anicetgdn AI
                </h3>
                <p className="text-zinc-500 text-[11px]">Personnalisez la tonalité, l'écriture et les objectifs d'Anicetgdn AI.</p>
              </div>
              <button
                id="close-settings-btn"
                onClick={() => setShowSettings(false)}
                className="text-zinc-400 hover:text-white p-1 rounded hover:bg-zinc-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Presets Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2.5">
              {PRESET_INSTRUCTIONS.map((preset) => {
                const isSelected = systemInstruction === preset.instruction;
                return (
                  <button
                    id={`preset-${preset.id}`}
                    key={preset.id}
                    onClick={() => {
                      setSystemInstruction(preset.instruction);
                      updateActiveConfig({ systemInstruction: preset.instruction });
                    }}
                    className={`flex items-start text-left gap-2.5 p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-purple-950/20 border-purple-800/80 text-white ring-1 ring-purple-900/20"
                        : "bg-zinc-950 border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:bg-zinc-900"
                    }`}
                  >
                    <span className={`p-1.5 rounded-lg shrink-0 ${isSelected ? "bg-purple-900/50 text-purple-300" : "bg-zinc-800 text-zinc-400"}`}>
                      {preset.icon === "Sparkles" && <Sparkles className="h-4 w-4" />}
                      {preset.icon === "Code" && <Code className="h-4 w-4" />}
                      {preset.icon === "PenTool" && <PenTool className="h-4 w-4" />}
                      {preset.icon === "GraduationCap" && <GraduationCap className="h-4 w-4" />}
                      {preset.icon === "Calculator" && <Calculator className="h-4 w-4" />}
                      {preset.icon === "Atom" && <Atom className="h-4 w-4" />}
                      {preset.icon === "Dna" && <Dna className="h-4 w-4" />}
                    </span>
                    <div className="space-y-0.5 min-w-0">
                      <span className="block text-[11px] font-bold text-zinc-200 truncate">{preset.name}</span>
                      <p className="text-[9px] leading-snug text-zinc-500 line-clamp-2">{preset.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Raw prompt manual config */}
            <div className="space-y-1.5">
              <label className="block text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Consignes de base personnalisées</label>
              <textarea
                id="custom-instruction-textarea"
                rows={2}
                value={systemInstruction}
                onChange={(e) => {
                  setSystemInstruction(e.target.value);
                  updateActiveConfig({ systemInstruction: e.target.value });
                }}
                className="w-full text-xs bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-zinc-300 focus:outline-none focus:border-emerald-700"
              />
            </div>
          </div>
        )}

        {/* Scrollable central desk */}
        <div id="workspace-scroll" className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          
          {/* Welcome Dashboard (ChatGPT style landing designed purely for Anicetgdn AI) */}
          {(!activeId || activeMessages.length === 0) ? (
            <div id="welcome-container" className="h-full flex flex-col justify-center items-center max-w-xl mx-auto py-24 space-y-4 select-none text-center">
              <h1 className="text-4xl font-bold font-display tracking-tight text-white sm:text-5xl">
                {greeting}{user?.displayName ? `, ${user.displayName.split(" ")[0]}` : ""} !
              </h1>
              <h2 className="text-2xl font-medium text-purple-400 sm:text-3xl font-display">
                Comment puis-je vous aider ?
              </h2>
            </div>
          ) : (
            /* Active Live Chats Screen */
            <div className="max-w-3xl mx-auto space-y-6">
              {activeMessages.map((msg) => {
                const isUser = msg.role === "user";
                return (
                  <div
                    id={`msg-node-${msg.id}`}
                    key={msg.id}
                    onMouseDown={() => {
                      if (isUser) startLongPress(msg.id, msg.parts);
                    }}
                    onMouseUp={cancelLongPress}
                    onMouseLeave={cancelLongPress}
                    onTouchStart={() => {
                      if (isUser) startLongPress(msg.id, msg.parts);
                    }}
                    onTouchEnd={cancelLongPress}
                    onTouchCancel={cancelLongPress}
                    onTouchMove={cancelLongPress}
                    onContextMenu={(e) => {
                      if (isUser) {
                        e.preventDefault();
                        setActiveMenuMsgId(msg.id);
                        setEditMsgInput(msg.parts);
                      }
                    }}
                    className={`flex gap-4 p-4 rounded-2xl border transition-all relative select-none md:select-text ${
                      isUser
                        ? "bg-zinc-900/60 border-zinc-800 ml-8 md:ml-16 shadow-sm cursor-pointer hover:border-zinc-750"
                        : "bg-zinc-900/10 border-zinc-900 mr-8 md:mr-16"
                    } ${activeMenuMsgId === msg.id ? "ring-2 ring-purple-500/50 border-purple-800/80" : ""}`}
                    title={isUser ? "Restez appuyé de manière prolongée pour modifier ce message" : undefined}
                  >
                    {/* The long-press action menu card next to the bubble */}
                    {activeMenuMsgId === msg.id && (
                      <div 
                        id={`menu-box-${msg.id}`}
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        className={`absolute z-30 bg-zinc-950 border border-zinc-805 rounded-2xl p-2 shadow-2xl animate-fade-in flex flex-col gap-1 w-48 max-w-[85vw] ${
                          isUser 
                            ? "right-2 -top-16" 
                            : "left-2 -top-16"
                        }`}
                      >
                        <button
                          id={`action-edit-${msg.id}`}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingMsgId(msg.id);
                            setEditMsgInput(msg.parts);
                            setActiveMenuMsgId(null);
                          }}
                          className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-zinc-200 hover:text-white hover:bg-zinc-900/80 transition-all flex items-center gap-2 cursor-pointer"
                        >
                          <Edit className="h-4 w-4 text-purple-400" />
                          <span>Modifier le texte</span>
                        </button>
                        <button
                          id={`action-close-${msg.id}`}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuMsgId(null);
                          }}
                          className="w-full text-left px-3 py-1.5 rounded-xl text-[11px] font-semibold text-zinc-500 hover:text-zinc-350 hover:bg-zinc-900/40 transition-all flex items-center gap-2 cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" />
                          <span>Annuler</span>
                        </button>
                      </div>
                    )}

                    {/* User / robot badge avatar */}
                    <div className="shrink-0" onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
                      {isUser ? (
                        <div className="h-8 w-8 flex items-center justify-center rounded-xl bg-purple-950 border border-purple-800/40 text-purple-300 font-bold text-xs">
                          <User className="h-4 w-4" />
                        </div>
                      ) : (
                        <div className="h-8 w-8 flex items-center justify-center rounded-xl bg-red-950 border border-red-800/40 text-red-400 font-bold text-xs relative">
                          <div className="absolute inset-0 rounded-xl bg-red-500/20 filter blur" />
                          <Ladybug className="h-4.5 w-4.5 relative" strokeWidth={2.4} />
                        </div>
                      )}
                    </div>

                    {/* Chat dialog bubble */}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-zinc-400">
                          {isUser ? "Vous" : "Anicetgdn AI"}
                        </span>
                        <div className="flex items-center gap-1.5" onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
                          <span className="text-[9px] text-zinc-500 mr-1">{msg.timestamp}</span>
                          
                          {/* Quick direct Pencil Edit utility */}
                          {isUser && (
                            <button
                              id={`edit-direct-btn-${msg.id}`}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingMsgId(msg.id);
                                setEditMsgInput(msg.parts);
                              }}
                              className="p-1 rounded text-zinc-600 hover:text-purple-400 hover:bg-zinc-850 cursor-pointer transition-colors"
                              title="Modifier le texte"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {/* Play/Listen to message voice read-out trigger */}
                          <button
                            id={`speak-msg-btn-${msg.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              playMessageTextAloud(msg.parts, msg.id);
                            }}
                            className={`p-1 rounded cursor-pointer transition-all ${
                              currentlyReadingId === msg.id
                                ? "text-emerald-400 bg-emerald-950/40 hover:bg-emerald-950/60 ring-1 ring-emerald-800"
                                : "text-zinc-600 hover:text-zinc-300 hover:bg-zinc-850"
                            }`}
                            title={currentlyReadingId === msg.id ? "Arrêter d'écouter" : "Écouter le message"}
                          >
                            {currentlyReadingId === msg.id ? (
                              <VolumeX className="h-3.5 w-3.5 animate-pulse text-emerald-400" />
                            ) : (
                              <Volume2 className="h-3.5 w-3.5" />
                            )}
                          </button>

                          <button
                            id={`copy-msg-btn-${msg.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              copyMessageText(msg.parts, msg.id);
                            }}
                            className="p-1 rounded text-zinc-600 hover:text-zinc-350 hover:bg-zinc-850 cursor-pointer transition-colors"
                            title="Copier la réponse"
                          >
                            {copiedMessageId === msg.id ? (
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Display attachment first if added to user's message bubble */}
                      {msg.imageUrl && (
                        <div className="max-w-md my-2 rounded-xl border border-zinc-800 bg-zinc-950/50 p-1 divide-zinc-800 overflow-hidden shadow-md" onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
                          <img
                            src={msg.imageUrl}
                            alt="Visual Attachment"
                            className="max-h-64 md:max-h-80 w-auto rounded-lg object-contain select-none shadow hover:brightness-105 transition duration-200"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      )}

                      {/* Reading state spinner loader or inline editing field */}
                      {msg.parts === "" ? (
                        <div className="flex items-center gap-2 text-zinc-500 text-xs py-1">
                          <span className="animate-bounce">●</span>
                          <span className="animate-bounce delay-100">●</span>
                          <span className="animate-bounce delay-200">●</span>
                          <span className="text-[10px] italic text-zinc-600 ml-1 font-mono">Génération en cours...</span>
                        </div>
                      ) : editingMsgId === msg.id ? (
                        <div 
                          className="space-y-3 pt-1" 
                          onMouseDown={(e) => e.stopPropagation()} 
                          onTouchStart={(e) => e.stopPropagation()}
                        >
                          <textarea
                            id={`edit-textbox-${msg.id}`}
                            value={editMsgInput}
                            onChange={(e) => setEditMsgInput(e.target.value)}
                            className="w-full min-h-[90px] p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 font-sans transition-all leading-relaxed select-all"
                            placeholder="Modifier le texte du message..."
                            autoFocus
                          />
                          <div className="flex items-center gap-2">
                            <button
                              id={`save-edit-btn-${msg.id}`}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditMessageSave(msg.id);
                              }}
                              className="px-3.5 py-1.5 rounded-xl bg-purple-650 hover:bg-purple-600 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow transition-all"
                            >
                              <Check className="h-3.5 w-3.5" />
                              <span>Enregistrer</span>
                            </button>
                            <button
                              id={`cancel-edit-btn-${msg.id}`}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingMsgId(null);
                              }}
                              className="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-zinc-300 font-semibold text-xs border border-zinc-750 cursor-pointer transition-all"
                            >
                              Annuler
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-zinc-200 leading-relaxed markdown-body">
                          <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{msg.parts}</Markdown>
                        </div>
                      )}

                      {/* Display Grounding Search Sources if relevant */}
                      {!isUser && msg.sources && msg.sources.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-zinc-900">
                          <h4 className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                            <Globe className="h-3 w-3 animate-pulse" />
                            Sources Web consultées en temps réel
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2">
                            {msg.sources.map((src, idx) => {
                              if (!src.web?.uri) return null;
                              return (
                                <a
                                  id={`search-source-${msg.id}-${idx}`}
                                  key={idx}
                                  href={src.web.uri}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center justify-between p-2 rounded-lg bg-zinc-950 border border-zinc-900 hover:bg-zinc-900 hover:border-zinc-800 text-[10px] max-w-full text-zinc-350 transition-colors"
                                >
                                  <span className="truncate pr-2 font-medium">{src.web.title || src.web.uri}</span>
                                  <ExternalLink className="h-3 w-3 text-zinc-600 shrink-0" />
                                </a>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* Message Input Footer panel */}
        <footer id="chat-composer" className="border-t border-zinc-900 bg-zinc-950 p-4 sticky bottom-0 z-10 w-full">
          <div className="max-w-3xl mx-auto">
            
            {/* Attachment preview pane */}
            {attachedImage && (
              <div className="mb-3.5 flex items-center justify-between p-2.5 rounded-2xl border border-zinc-800 bg-zinc-900/40 max-w-sm animate-fade-in shadow-lg">
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={`data:${attachedImage.type};base64,${attachedImage.base64}`}
                    alt="previsualisation"
                    className="h-11 w-11 object-cover rounded-xl border border-zinc-700 select-none shadow-md"
                  />
                  <div className="truncate pr-2">
                    <span className="block text-xs font-semibold text-zinc-200 truncate">{attachedImage.name}</span>
                    <span className="block text-[9px] text-emerald-400 uppercase tracking-wider font-bold">Image Attachée</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAttachedImage(null)}
                  className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                  title="Supprimer la photo"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Form layout containing integrated three-dots and trigger actions */}
            <form onSubmit={handleSubmit} className="relative flex items-end">
              
              {/* Three dots button inside the leftmost part of prompt box */}
              <div className="absolute left-2.5 bottom-2 z-20">
                <button
                  id="more-actions-trigger"
                  type="button"
                  onClick={() => setShowMoreActions(!showMoreActions)}
                  className={`h-9 w-9 rounded-xl flex items-center justify-center border transition-all cursor-pointer ${
                    isListening
                      ? "bg-red-950/50 border-red-850 text-red-500 animate-pulse scale-105"
                      : showMoreActions
                      ? "bg-zinc-850 text-zinc-100 border-zinc-750"
                      : "bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-200 border-zinc-850"
                  }`}
                  title="Plus d'actions (Micro, Photo, Galerie)"
                >
                  <MoreVertical className={isListening ? "animate-spin text-red-500 h-4.5 w-4.5" : "h-4.5 w-4.5"} />
                </button>

                {/* Floating tool action bubble popover dropdown */}
                {showMoreActions && (
                  <div
                    id="more-actions-popup"
                    className="absolute left-0 bottom-12 z-[30] w-56 rounded-2xl border border-zinc-850 bg-zinc-950 p-1.5 shadow-2xl flex flex-col gap-0.5 animate-fade-in select-none"
                    onMouseLeave={() => setShowMoreActions(false)}
                  >
                    <div className="px-2.5 py-1.5 text-[9px] font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-900 mb-1">
                      Outils & Médias
                    </div>

                    {/* Speech Recognition Toggle */}
                    <button
                      type="button"
                      onClick={() => {
                        toggleSpeechRecognition();
                        setShowMoreActions(false);
                      }}
                      className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-xl text-xs font-semibold text-left transition cursor-pointer ${
                        isListening
                          ? "bg-red-950/40 text-red-400 border-red-900/30"
                          : "text-zinc-300 hover:bg-zinc-900 hover:text-white"
                      }`}
                      title="Activer la reconnaissance vocale"
                    >
                      <Mic className={`h-4 w-4 ${isListening ? "text-red-500 animate-pulse" : "text-zinc-400"}`} strokeWidth={2.4} />
                      <span>{isListening ? "Arrêter la dictée" : "Dictée vocale"}</span>
                    </button>

                    {/* Live Camera Stream Launcher */}
                    <button
                      type="button"
                      onClick={() => {
                        startCameraStream();
                        setShowMoreActions(false);
                      }}
                      className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-xl text-xs font-semibold text-zinc-300 hover:bg-zinc-900 hover:text-white text-left transition cursor-pointer"
                      title="Capturer une photo"
                    >
                      <Camera className="h-4 w-4 text-zinc-400" strokeWidth={2.4} />
                      <span>Prendre une photo</span>
                    </button>

                    {/* Local File Browser Picker / Gallery */}
                    <label
                      className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-xl text-xs font-semibold text-zinc-300 hover:bg-zinc-900 hover:text-white text-left transition cursor-pointer select-none"
                      title="Importer une image existante"
                    >
                      <Image className="h-4 w-4 text-zinc-400" strokeWidth={2.4} />
                      <span>Accéder à la galerie</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          handleGalleryUpload(e);
                          setShowMoreActions(false);
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>

              <textarea
                id="message-text-area"
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                disabled={isStreaming}
                placeholder="Message envoyé à Anicetgdn AI... (Entrée pour envoyer)"
                className="w-full resize-none rounded-2xl border border-zinc-800 bg-zinc-900 py-3.5 pl-13 pr-14 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-650 shadow-inner"
                style={{ minHeight: "52px" }}
              />

              {/* Submit Trigger button */}
              <button
                id="send-btn"
                type="submit"
                disabled={(!input.trim() && !attachedImage) || isStreaming}
                className={`absolute right-2.5 bottom-2.5 p-2 rounded-xl text-zinc-950 transition-all ${
                  (input.trim() || attachedImage) && !isStreaming
                    ? "bg-emerald-400 hover:bg-emerald-300 hover:scale-105 cursor-pointer"
                    : "bg-zinc-800 text-zinc-550 cursor-not-allowed"
                }`}
                title="Générer la réponse"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>

            <div className="flex items-center justify-between mt-2.5 px-1.5 text-[10px] text-zinc-500">
              <div className="flex items-center gap-1">
                <span>Modèle Actif : </span>
                <span className="font-mono text-zinc-400 font-semibold uppercase tracking-wider">{selectedModel}</span>
              </div>
              <p className="hidden sm:block">
                Anicetgdn AI est configuré pour être constructif s'il identifie des formulations sensibles.
              </p>
            </div>

          </div>
        </footer>

        {/* QR Access Modal & Dynamic links for mobile devices */}
        {showQrModal && (
          <div id="qr-modal-overlay" className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-fade-in">
            <div id="qr-modal-card" className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 max-w-sm w-full text-center relative shadow-2xl space-y-5">
              <button
                id="close-qr-modal-btn"
                onClick={() => setShowQrModal(false)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded hover:bg-zinc-800 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-purple-950 text-purple-300">
                <QrCode className="h-6 w-6" />
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">Accès Mobile Simplifié</h3>
                <p className="text-xs text-zinc-400">Poursuivez instantanément la conversation sur votre téléphone mobile ou tablette.</p>
              </div>

              {/* QR Image render of active hosting URL */}
              <div className="bg-white p-4 rounded-2xl inline-block shadow-md">
                <img
                  className="mx-auto" 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(remoteUrl)}&bgcolor=ffffff&color=18181b`}
                  alt="Code QR de connexion mobile"
                  referrerPolicy="no-referrer"
                  title="Numérisez ce code avec l'appareil photo de votre smartphone pour interagir en mobilité"
                />
              </div>

              {/* Manual URL display with copy */}
              <div className="space-y-2.5">
                <p className="text-[10px] text-zinc-500">Lien d'accès permanent :</p>
                <div className="flex items-center justify-between gap-2 p-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs">
                  <span className="truncate text-zinc-400 select-all flex-1 text-left pl-1 select-none font-mono text-[10px]">{remoteUrl}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(remoteUrl);
                      alert("Lien d'accès mobile copié ! Envoyez-le à votre mobile ou visitez-le.");
                    }}
                    className="p-1 px-2.5 rounded bg-zinc-800 hover:bg-zinc-750 text-[10px] text-zinc-200 active:scale-95 cursor-pointer font-bold"
                  >
                    Copier
                  </button>
                </div>
              </div>

              <p className="text-[9px] text-zinc-500">
                L'utilisation de la recherche Google et de la persistance cloud s'applique de manière transparente sur mobile une fois identifié.
              </p>
            </div>
          </div>
        )}

        {/* Live Camera Viewfinder Modal */}
        {showCameraViewfinder && (
          <div id="camera-overlay" className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center p-4 z-50 animate-fade-in select-none">
            <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col relative">
              
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-zinc-850 bg-zinc-950">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded bg-emerald-950 text-emerald-400 font-bold">
                    <Camera className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-xs font-semibold text-zinc-100 font-display">Appareil Photo en Direct</span>
                </div>
                <button
                  onClick={stopCameraStream}
                  className="p-1 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer transition-colors"
                  title="Fermer la caméra"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Viewfinder block */}
              <div className="relative aspect-video w-full bg-zinc-950 flex items-center justify-center overflow-hidden">
                {cameraError ? (
                  <div className="max-w-xs text-center space-y-3 p-4">
                    <p className="text-xs text-red-400 font-medium">{cameraError}</p>
                    <button
                      type="button"
                      onClick={startCameraStream}
                      className="px-4 py-2 rounded-xl bg-zinc-850 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-200 cursor-pointer"
                    >
                      Réessayer
                    </button>
                  </div>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="h-full w-full object-cover scale-x-100"
                    />
                    {/* Viewfinder grid overlays */}
                    <div className="absolute inset-0 border border-dashed border-white/20 pointer-events-none grid grid-cols-3 grid-rows-3">
                      <div className="border-r border-b border-dashed border-white/10" />
                      <div className="border-r border-b border-dashed border-white/10" />
                      <div className="border-b border-dashed border-white/10" />
                      <div className="border-r border-b border-dashed border-white/10" />
                      <div className="border-r border-b border-dashed border-white/10" />
                      <div className="border-b border-dashed border-white/10" />
                    </div>
                  </>
                )}
              </div>

              {/* Controls footer */}
              <div className="p-5 flex items-center justify-center gap-4 bg-zinc-950 border-t border-zinc-850">
                <button
                  type="button"
                  onClick={stopCameraStream}
                  className="px-4 py-2 rounded-xl text-xs text-zinc-400 bg-zinc-900 border border-zinc-850 hover:bg-zinc-800 cursor-pointer transition"
                >
                  Annuler
                </button>
                
                <button
                  type="button"
                  disabled={!!cameraError}
                  onClick={capturePhoto}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-xs tracking-wide transition-all ${
                    cameraError
                      ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                      : "bg-emerald-400 hover:bg-emerald-300 text-zinc-950 cursor-pointer active:scale-95 shadow-md"
                  }`}
                >
                  <Camera className="h-4 w-4" />
                  <span>Prendre la photo</span>
                </button>
              </div>

            </div>
          </div>
        )}

        {/* Firebase Authentication Troubleshoot & Assistance Modal */}
        {authError && (
          <div id="auth-error-overlay" className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 animate-fade-in select-none">
            <div id="auth-error-card" className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 max-w-md w-full relative shadow-2xl space-y-5">
              <button
                id="close-auth-error-btn"
                onClick={() => setAuthError(null)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded hover:bg-zinc-800 cursor-pointer transition-colors"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-950 text-red-400">
                <ShieldCheck className="h-6 w-6" />
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-bold text-white font-display text-left">Configuration de Connexion requise</h3>
                <p className="text-xs text-zinc-400 text-left">
                  Une restriction de sécurité empêche la connexion Google sur cet appareil. Voici comment résoudre cela en quelques instants :
                </p>
              </div>

              {/* Specific message if unauthorized domain */}
              {authError.code.includes("unauthorized-domain") || authError.message.toLowerCase().includes("unauthorized domain") ? (
                <div className="space-y-3.5 bg-zinc-950 border border-zinc-850 p-4 rounded-xl text-left">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-red-400 uppercase tracking-wide">Étape 1 : Enregistrer votre adresse</span>
                    <p className="text-[11px] text-zinc-300 leading-relaxed">
                      Firebase requiert l'enregistrement explicite de l'adresse de votre application en tant que domaine autorisé.
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <span className="text-[9px] text-zinc-500 font-mono">Adresse à copier (Domaine) :</span>
                    <div className="flex items-center justify-between gap-2 p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs">
                      <span className="truncate text-zinc-300 flex-1 font-mono text-[10px] select-all">{authError.domain}</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (authError.domain) {
                            navigator.clipboard.writeText(authError.domain);
                            alert("Copie réussie !");
                          }
                        }}
                        className="p-1 px-2 pb-1 bg-zinc-800 hover:bg-zinc-700 text-[10px] font-bold text-zinc-200 rounded cursor-pointer"
                      >
                        Copier
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-1.5 border-t border-zinc-900 text-[11px] text-zinc-400 leading-relaxed">
                    <span className="font-bold text-zinc-300 block">Dans votre console Firebase :</span>
                    <ol className="list-decimal pl-4 space-y-1">
                      <li>Ouvrez <strong className="text-zinc-200">Authentication</strong> → <strong className="text-zinc-200">Paramètres</strong></li>
                      <li>Cliquez sur <strong className="text-zinc-200">Domaines autorisés</strong> (Authorized Domains)</li>
                      <li>Cliquez sur <strong className="text-zinc-200">Ajouter un domaine (Add Domain)</strong> et collez l'adresse ci-dessus</li>
                    </ol>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 bg-zinc-950 border border-zinc-855 p-4 rounded-xl text-left">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Détails de l'erreur</span>
                  <p className="text-xs text-red-500 font-mono break-all">{authError.code || "erreur_connexion"} : {authError.message}</p>
                </div>
              )}

              {/* Navigation Action fallback for Safari/Mobile nested browsing */}
              <div className="space-y-2.5 pt-2">
                <p className="text-[10px] text-zinc-400 text-left leading-relaxed">
                  💡 <strong className="text-zinc-300">Sur Mobile et Safari</strong>, les popups de connexion tiers sont souvent bloqués. Nous vous conseillons d'ouvrir l'application dans son propre onglet :
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        window.open(window.location.href, "_blank");
                      }
                    }}
                    className="flex-1 py-2 rounded-xl bg-purple-650 hover:bg-purple-600 text-white font-bold text-xs cursor-pointer text-center flex items-center justify-center gap-1.5 shadow"
                  >
                    <span>Ouvrir dans un nouvel onglet</span>
                    <ExternalLink className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthError(null)}
                    className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-zinc-300 text-xs font-semibold border border-zinc-750 cursor-pointer"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* API Key configuration and instructions Modal */}
        {showKeyHelpModal && (
          <div id="key-help-overlay" className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 animate-fade-in select-none">
            <div id="key-help-card" className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 max-w-md w-full relative shadow-2xl space-y-5">
              <button
                id="close-key-help-btn"
                onClick={() => setShowKeyHelpModal(false)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded hover:bg-zinc-800 cursor-pointer transition-colors"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-950 text-amber-400">
                <KeyRound className="h-6 w-6" />
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-bold text-white font-display text-left">Configuration de la clé API Gemini</h3>
                <p className="text-xs text-zinc-400 text-left">
                  {backendConfigured 
                    ? "Votre clé API Gemini est configurée avec succès et l'application fonctionne parfaitement."
                    : "L'application requiert une clé API Google Gemini pour faire fonctionner l'intelligence artificielle."}
                </p>
              </div>

              {!backendConfigured ? (
                <div className="space-y-3.5 bg-zinc-950 border border-zinc-850 p-4 rounded-xl text-left">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wide">Comment configurer la clé :</span>
                    <p className="text-[11px] text-zinc-300 leading-relaxed">
                      Voici les étapes simples pour connecter votre clé API à votre application :
                    </p>
                  </div>

                  <div className="space-y-1.5 pt-1 text-[11px] text-zinc-400 leading-relaxed">
                    <ol className="list-decimal pl-4 space-y-2">
                      <li>
                        <strong className="text-zinc-250">Générez une clé gratuite</strong> si vous n'en avez pas, sur <a href="https://aistudio.google.com" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">aistudio.google.com <ExternalLink className="inline h-3 w-3" /></a>
                      </li>
                      <li>
                        Dans le menu de l'éditeur <strong className="text-zinc-250">Google AI Studio</strong> (sur votre écran principal de développement), cliquez sur l'onglet <strong className="text-zinc-250">Secrets / Paramètres</strong> en haut à droite.
                      </li>
                      <li>
                        Ajoutez la variable <code className="text-amber-400 bg-zinc-900 px-1 py-0.5 rounded font-mono text-[10px]">GEMINI_API_KEY</code> avec votre clé générée. Le serveur de l'application sera mis à jour instantanément !
                      </li>
                    </ol>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 bg-zinc-950 border border-emerald-950 p-4 rounded-xl text-left flex items-start gap-2.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 mt-1.5 shrink-0 animate-pulse" />
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide">Statut : Connecté</span>
                    <p className="text-[11px] text-zinc-300">
                      Votre serveur utilise actuellement la clé <code className="font-mono text-zinc-400">GEMINI_API_KEY</code> fournie pour alimenter les conversations. Tout est opérationnel !
                    </p>
                  </div>
                </div>
              )}

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowKeyHelpModal(false)}
                  className="w-full py-2 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-white font-semibold text-xs cursor-pointer border border-zinc-700 text-center"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
