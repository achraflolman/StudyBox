
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { db, Timestamp } from '../../../services/firebase';
import { GoogleGenAI } from '@google/genai';
import type { Note, AppUser, ModalContent } from '../../../types';
import { PlusCircle, Save, Trash2, Edit, NotebookPen, ChevronDown, MousePointer, Pen, Eraser, Square, Minus, Type as TypeIcon, Undo, Redo, Palette, Highlighter, Copy, ClipboardPaste, Scissors, LayoutGrid, Baseline, CaseSensitive, GripVertical, Minimize, Maximize, ArrowLeft, Sparkles, Loader2, FileText, Bold, Italic, Underline, Strikethrough, List, ListOrdered } from 'lucide-react';

interface NotesViewProps {
  userId: string;
  user: AppUser;
  t: (key: string, replacements?: any) => string;
  tSubject: (key: string) => string;
  getThemeClasses: (variant: string) => string;
  showAppModal: (content: ModalContent) => void;
  initialContext?: { note?: Note };
  onBack?: () => void;
}

// --- TYPE DEFINITIONS for Canvas Objects ---
type NoteObjectType = 'path' | 'text' | 'rect' | 'line';

interface NoteObjectBase {
  id: string;
  type: NoteObjectType;
  x: number;
  y: number;
  color: string;
  strokeWidth: number;
}

interface PathObject extends NoteObjectBase {
  type: 'path';
  points: { x: number; y: number }[];
  isHighlighter?: boolean;
}

interface TextObject extends NoteObjectBase {
  type: 'text';
  text: string;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
}

interface RectObject extends NoteObjectBase {
  type: 'rect';
  width: number;
  height: number;
}

interface LineObject extends NoteObjectBase {
    type: 'line';
    x2: number;
    y2: number;
}

type NoteObject = PathObject | TextObject | RectObject | LineObject;
const availableFonts = [ 'Arial', 'Verdana', 'Times New Roman', 'Courier New', 'Comic Sans MS' ];


// ==================================
//      NOTE CREATION MODAL
// ==================================
const NoteCreationModal: React.FC<{
    onClose: () => void;
    onCreate: (title: string, noteType: 'text' | 'drawing', background?: Note['background']) => void;
    t: (key: string) => string;
    getThemeClasses: (variant: string) => string;
}> = ({ onClose, onCreate, t, getThemeClasses }) => {
    const [title, setTitle] = useState('');
    const [noteType, setNoteType] = useState<'text' | 'drawing' | null>(null);
    const [background, setBackground] = useState<Note['background']>('blank');

    const handleCreate = () => {
        if (title.trim() && noteType) {
            onCreate(title, noteType, noteType === 'drawing' ? background : undefined);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold mb-4">{t('add_note_button')}</h3>
                <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder={t('add_note_title_placeholder')}
                    className="w-full p-2 border rounded-lg mb-4"
                />
                
                {noteType === null ? (
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <button onClick={() => setNoteType('text')} className={`p-4 border-2 rounded-lg text-center bg-gray-50 hover:bg-gray-100`}>
                            <TypeIcon className="mx-auto w-8 h-8 mb-2" />
                            <span className="font-semibold">Tekstnotitie</span>
                        </button>
                        <button onClick={() => setNoteType('drawing')} className={`p-4 border-2 rounded-lg text-center bg-gray-50 hover:bg-gray-100`}>
                            <Pen className="mx-auto w-8 h-8 mb-2" />
                            <span className="font-semibold">Canvasnotitie</span>
                        </button>
                    </div>
                ) : noteType === 'drawing' && (
                    <div className="mb-4">
                        <p className="font-semibold mb-2">Kies een achtergrond:</p>
                        <div className="grid grid-cols-3 gap-2">
                            <button onClick={() => setBackground('blank')} className={`p-3 border-2 rounded-lg ${background === 'blank' ? getThemeClasses('border') : ''}`}>Leeg</button>
                            <button onClick={() => setBackground('grid')} className={`p-3 border-2 rounded-lg ${background === 'grid' ? getThemeClasses('border') : ''}`}>Raster</button>
                            <button onClick={() => setBackground('lines')} className={`p-3 border-2 rounded-lg ${background === 'lines' ? getThemeClasses('border') : ''}`}>Lijntjes</button>
                        </div>
                    </div>
                )}

                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="py-2 px-4 rounded-lg bg-gray-200 font-semibold">{t('cancel_button')}</button>
                    <button onClick={handleCreate} disabled={!title.trim() || !noteType} className={`py-2 px-4 rounded-lg text-white font-bold ${getThemeClasses('bg')} disabled:opacity-50`}>{t('confirm_button')}</button>
                </div>
            </div>
        </div>
    );
};


const AIGenerateNoteModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (prompt: string) => Promise<void>;
    isGenerating: boolean;
    getThemeClasses: (variant: string) => string;
    t: (key: string, replacements?: any) => string;
    botName: string;
}> = ({ isOpen, onClose, onGenerate, isGenerating, getThemeClasses, t, botName }) => {
    const [prompt, setPrompt] = useState('');
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold mb-4">{t('ai_generate_notes_title_mimi', { botName })}</h3>
                <textarea
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    placeholder="Geef een opdracht, bijv: 'Vat de belangrijkste punten van de Franse Revolutie samen' of 'Maak een lijst van de formules voor de stelling van Pythagoras'"
                    className="w-full p-2 border rounded-lg mb-4"
                    rows={5}
                />
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} disabled={isGenerating} className="py-2 px-4 rounded-lg bg-gray-200 font-semibold">Annuleren</button>
                    <button onClick={() => onGenerate(prompt)} disabled={isGenerating || !prompt.trim()} className={`py-2 px-4 rounded-lg text-white font-bold ${getThemeClasses('bg')} disabled:opacity-50 w-32 flex justify-center`}>
                        {isGenerating ? <Loader2 className="animate-spin"/> : 'Genereer'}
                    </button>
                </div>
            </div>
        </div>
    );
};


// ==================================
//      TEXT NOTE EDITOR (NEW STYLE)
// ==================================
interface TextNoteEditorProps {
    note: Note;
    onBack: () => void;
    t: (key: string, replacements?: any) => string;
    getThemeClasses: (variant: string) => string;
    showAppModal: (c: ModalContent) => void;
    user: AppUser;
}

const FormattingToolbar: React.FC = () => {
    const applyFormat = (command: string) => {
        const editor = document.getElementById('note-editor-content');
        if (editor) editor.focus();
        document.execCommand(command, false, undefined);
    };

    return (
        <div className="flex items-center gap-1 p-2 bg-gray-100 rounded-t-lg border-b flex-wrap">
            <button title="Bold" onMouseDown={e => e.preventDefault()} onClick={() => applyFormat('bold')} className="p-2 hover:bg-gray-200 rounded-md"><Bold size={16}/></button>
            <button title="Italic" onMouseDown={e => e.preventDefault()} onClick={() => applyFormat('italic')} className="p-2 hover:bg-gray-200 rounded-md"><Italic size={16}/></button>
            <button title="Underline" onMouseDown={e => e.preventDefault()} onClick={() => applyFormat('underline')} className="p-2 hover:bg-gray-200 rounded-md"><Underline size={16}/></button>
        </div>
    );
};

const TextNoteEditor: React.FC<TextNoteEditorProps> = ({ note, onBack, t, getThemeClasses, showAppModal, user }) => {
    const [content, setContent] = useState(note.content || '');
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const contentRef = useRef(note.content || '');
    const [isAIGenerateModalOpen, setIsAIGenerateModalOpen] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const botName = user.aiBotName || 'Mimi';

    useEffect(() => {
        contentRef.current = content;
    }, [content]);

    const handleContentChange = (e: React.FormEvent<HTMLDivElement>) => {
        const newContent = e.currentTarget.innerHTML;
        setContent(newContent);
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
            db.doc(`users/${note.ownerId}/notes/${note.id}`).update({
                content: newContent,
                updatedAt: Timestamp.now()
            });
        }, 1500);
    };
    
    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
            if (contentRef.current !== note.content) {
                 db.doc(`users/${note.ownerId}/notes/${note.id}`).update({
                    content: contentRef.current,
                    updatedAt: Timestamp.now()
                });
            }
        };
    }, [note.id, note.ownerId, note.content]);

    const handleAIGenerateText = async (prompt: string) => {
        setIsAIGenerateModalOpen(false);
        setIsGenerating(true);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const languageName = user.languagePreference === 'nl' ? 'Nederlands' : 'English';
            const fullPrompt = `Je bent een studie-assistent. Geef een duidelijk, goed gestructureerd en grammaticaal correct antwoord. Schrijf in eenvoudige, duidelijke taal die voor een middelbare scholier makkelijk te begrijpen is. Begin direct met de uitleg; gebruik GEEN aanhef zoals 'Beste student'. Gebruik basis HTML voor opmaak: <b> voor vet, <i> voor cursief, <u> voor onderstreept, <ul> en <li> voor lijsten. Gebruik GEEN Markdown. De taal van het antwoord MOET ${languageName} zijn. Vraag: "${prompt}"`;
            
            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: fullPrompt });
            let generatedText = response.text.replace(/[*#`]/g, '');

            const editor = document.getElementById('note-editor-content');
            if (editor) {
                // Add line breaks if content already exists
                if (editor.innerHTML.trim().length > 0) {
                    editor.innerHTML += '<br><br>';
                }

                let i = 0;
                const typingInterval = setInterval(() => {
                    if (i >= generatedText.length) {
                        clearInterval(typingInterval);
                        setIsGenerating(false);
                        
                        // Final content update and save trigger
                        const finalContent = editor.innerHTML;
                        setContent(finalContent);
                        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
                        saveTimeoutRef.current = setTimeout(() => {
                             db.doc(`users/${note.ownerId}/notes/${note.id}`).update({
                                content: finalContent,
                                updatedAt: Timestamp.now()
                            });
                        }, 500);

                        return;
                    }

                    let char = generatedText[i];
                    
                    // If we find an HTML tag, append the whole thing at once
                    if (char === '<') {
                        const tagEndIndex = generatedText.indexOf('>', i);
                        if (tagEndIndex !== -1) {
                            const tag = generatedText.substring(i, tagEndIndex + 1);
                            editor.innerHTML += tag;
                            i = tagEndIndex + 1;
                            return;
                        }
                    }
                    
                    editor.innerHTML += char;
                    i++;

                    editor.scrollTop = editor.scrollHeight;
                }, 20);
            }

        } catch (error) {
            console.error(error);
            showAppModal({ text: "AI generation failed." });
            setIsGenerating(false);
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto animate-fade-in">
             <AIGenerateNoteModal isOpen={isAIGenerateModalOpen} onClose={() => setIsAIGenerateModalOpen(false)} onGenerate={handleAIGenerateText} isGenerating={isGenerating} getThemeClasses={getThemeClasses} t={t} botName={botName} />
             <div className="mb-4 flex justify-between items-center">
                <button onClick={onBack} className="flex items-center gap-1 font-semibold bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-lg"><ArrowLeft size={16}/> {t('back_button')}</button>
                <button onClick={() => setIsAIGenerateModalOpen(true)} disabled={isGenerating} className="flex items-center gap-2 font-semibold bg-purple-100 text-purple-700 hover:bg-purple-200 px-4 py-2 rounded-lg disabled:opacity-50">
                    {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16}/>}
                    {isGenerating ? 'Genereren...' : t('generate_with_mimi', { botName })}
                </button>
             </div>
            <div className={`p-6 sm:p-10 rounded-lg shadow-lg ${getThemeClasses('bg-light')}`}>
                <h2 className="text-3xl font-bold text-gray-800 border-b pb-3 mb-6 text-center">{note.title}</h2>
                <div className="bg-white rounded-lg shadow-inner">
                    <FormattingToolbar />
                    <div
                        id="note-editor-content"
                        contentEditable={!isGenerating}
                        onInput={handleContentChange}
                        dangerouslySetInnerHTML={{ __html: content }}
                        style={{ textAlign: 'left', direction: 'ltr' }}
                        className="w-full h-[55vh] p-4 text-base resize-none border-none focus:ring-0 bg-transparent leading-relaxed overflow-y-auto"
                    />
                </div>
            </div>
        </div>
    );
};

// ==================================
//      DRAWING NOTE EDITOR
// ==================================
const getObjectBounds = (obj: NoteObject): { x: number, y: number, width: number, height: number } => {
    switch (obj.type) {
        case 'rect':
            return { x: obj.x, y: obj.y, width: obj.width, height: obj.height };
        case 'line':
            return {
                x: Math.min(obj.x, obj.x2),
                y: Math.min(obj.y, obj.y2),
                width: Math.abs(obj.x - obj.x2),
                height: Math.abs(obj.y - obj.y2)
            };
        case 'path':
            if (obj.points.length === 0) return { x: obj.x, y: obj.y, width: 0, height: 0 };
            const minX = Math.min(...obj.points.map(p => p.x));
            const maxX = Math.max(...obj.points.map(p => p.x));
            const minY = Math.min(...obj.points.map(p => p.y));
            const maxY = Math.max(...obj.points.map(p => p.y));
            return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
        case 'text':
             return { x: obj.x, y: obj.y - obj.height, width: obj.width, height: obj.height }; // Y is baseline, so adjust
    }
};

const isPointInRect = (point: { x: number, y: number }, rect: { x: number, y: number, width: number, height: number }) => {
    return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
};

const isIntersecting = (rect1: { x: number, y: number, width: number, height: number }, rect2: { x: number, y: number, width: number, height: number }) => {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
};

const NoteEditor: React.FC<{
    note: Note;
    onClose: () => void;
    onNoteUpdate: (id: string, data: Partial<Note>, isFinal?: boolean) => void;
    t: (key: string) => string;
    getThemeClasses: (variant: string) => string;
}> = ({ note, onClose, onNoteUpdate, t, getThemeClasses }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [objects, setObjects] = useState<NoteObject[]>([]);
    const objectsRef = useRef(objects);
    const [isDrawing, setIsDrawing] = useState(false);
    const [activeTool, setActiveTool] = useState<'select' | 'pen' | 'highlighter' | 'rect' | 'line' | 'text' | 'eraser'>('pen');
    const [color, setColor] = useState('#000000');
    const [pageColor, setPageColor] = useState(note.backgroundColor || '#FFFFFF');
    const [strokeWidth, setStrokeWidth] = useState(3);
    const [activeFont, setActiveFont] = useState('Arial');
    const [history, setHistory] = useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [selectedObjectIds, setSelectedObjectIds] = useState<Set<string>>(new Set());
    const [selectionRect, setSelectionRect] = useState<{x: number, y: number, width: number, height: number} | null>(null);
    const [movingStartPoint, setMovingStartPoint] = useState<{x: number, y: number} | null>(null);
    const [clipboard, setClipboard] = useState<NoteObject[]>([]);
    
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const isInteracting = useRef(false);
    const touchCache = useRef<{id: number, point: {x:number, y:number}}[]>([]);
    
    useEffect(() => {
        objectsRef.current = objects;
    }, [objects]);

    useEffect(() => {
        document.body.classList.add('drawing-editor-active');
        const canvas = canvasRef.current;
        if (canvas) {
            canvas.style.backgroundColor = pageColor;
        }
        return () => { document.body.classList.remove('drawing-editor-active'); };
    }, [pageColor]);

    const saveNote = useCallback((isFinal = false) => {
        onNoteUpdate(note.id, { 
            content: JSON.stringify(objectsRef.current), 
            updatedAt: Timestamp.now(),
            backgroundColor: pageColor 
        }, isFinal);
    }, [note.id, onNoteUpdate, pageColor]);
    
    useEffect(() => {
        const handler = setTimeout(() => {
            saveNote(false); // Debounced auto-save
        }, 2000);
        return () => clearTimeout(handler);
    }, [objects, pageColor, saveNote]);

    const handleClose = () => {
        saveNote(true); // Final save on close
        onClose();
    };

    const addToHistory = useCallback((newObjectsState: NoteObject[]) => {
        const newHistory = history.slice(0, historyIndex + 1);
        const newStateString = JSON.stringify(newObjectsState);
        if (newHistory.length > 0 && newStateString === newHistory[newHistory.length - 1]) return;
        newHistory.push(newStateString);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    }, [history, historyIndex]);

    const undo = useCallback(() => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            setObjects(JSON.parse(history[newIndex]));
        }
    }, [history, historyIndex]);
    
    const redo = useCallback(() => {
        if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            setObjects(JSON.parse(history[newIndex]));
        }
    }, [history, historyIndex]);
    
    const handleCopy = useCallback(() => {
        const selectedObjects = objects.filter(obj => selectedObjectIds.has(obj.id));
        setClipboard(selectedObjects);
    }, [objects, selectedObjectIds]);

    const handleCut = useCallback(() => {
        handleCopy();
        const newObjects = objects.filter(obj => !selectedObjectIds.has(obj.id));
        setObjects(newObjects);
        addToHistory(newObjects);
        setSelectedObjectIds(new Set());
    }, [handleCopy, objects, selectedObjectIds, addToHistory]);

    const handlePaste = useCallback(() => {
        if (clipboard.length === 0) return;
        const newObjects = clipboard.map(obj => ({
            ...obj,
            id: `obj_${Date.now()}_${Math.random()}`,
            x: obj.x + 20, // Offset pasted objects
            y: obj.y + 20
        }));
        const updatedObjects = [...objects, ...newObjects];
        setObjects(updatedObjects);
        addToHistory(updatedObjects);
    }, [clipboard, objects, addToHistory]);

    const handleDeleteSelected = useCallback(() => {
        if (selectedObjectIds.size === 0) return;
        const newObjects = objects.filter(obj => !selectedObjectIds.has(obj.id));
        setObjects(newObjects);
        addToHistory(newObjects);
        setSelectedObjectIds(new Set());
    }, [objects, selectedObjectIds, addToHistory]);
    
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') { e.preventDefault(); handleCopy(); }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') { e.preventDefault(); handleCut(); }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') { e.preventDefault(); handlePaste(); }
            if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); handleDeleteSelected(); }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
            if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleCopy, handleCut, handlePaste, handleDeleteSelected, undo, redo]);

    useEffect(() => {
        try {
            const parsedObjects = JSON.parse(note.content || '[]');
            setObjects(parsedObjects);
            const initialState = JSON.stringify(parsedObjects);
            setHistory([initialState]);
            setHistoryIndex(0);
        } catch (e) {
            setObjects([]);
            setHistory(['[]']);
            setHistoryIndex(0);
        }
    }, [note]);

    const getCanvasCoordinates = (clientX: number, clientY: number): { x: number; y: number } => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return {
            x: (clientX - rect.left - offset.x) / scale,
            y: (clientY - rect.top - offset.y) / scale,
        };
    };
    
    const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
        const gridSize = 20; // Fixed grid size, scaling is handled by canvas transform
        ctx.beginPath();
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 1 / scale;

        const startX = -offset.x / scale;
        const startY = -offset.y / scale;
        const endX = (width - offset.x) / scale;
        const endY = (height - offset.y) / scale;

        for (let x = Math.floor(startX / gridSize) * gridSize; x < endX; x += gridSize) {
            ctx.moveTo(x, startY);
            ctx.lineTo(x, endY);
        }

        for (let y = Math.floor(startY / gridSize) * gridSize; y < endY; y += gridSize) {
            ctx.moveTo(startX, y);
            ctx.lineTo(endX, y);
        }
        ctx.stroke();
    };
    const drawLines = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
        const lineSpacing = 24; // Fixed line spacing
        ctx.beginPath();
        ctx.strokeStyle = '#dbeafe';
        ctx.lineWidth = 1 / scale;
        
        const startX = -offset.x / scale;
        const startY = -offset.y / scale;
        const endX = (width - offset.x) / scale;
        const endY = (height - offset.y) / scale;

        for (let y = Math.floor(startY / lineSpacing) * lineSpacing; y < endY; y += lineSpacing) {
            ctx.moveTo(startX, y);
            ctx.lineTo(endX, y);
        }
        ctx.stroke();
    };
    
    const drawObject = (ctx: CanvasRenderingContext2D, obj: NoteObject) => {
        ctx.strokeStyle = obj.color;
        ctx.fillStyle = obj.color;
        ctx.lineWidth = obj.strokeWidth;
        ctx.globalAlpha = (obj as PathObject).isHighlighter ? 0.3 : 1.0;
    
        switch (obj.type) {
            case 'path':
                ctx.beginPath();
                obj.points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
                ctx.stroke();
                break;
            case 'rect':
                ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
                break;
            case 'line':
                ctx.beginPath();
                ctx.moveTo(obj.x, obj.y);
                ctx.lineTo(obj.x2, obj.y2);
                ctx.stroke();
                break;
            case 'text':
                ctx.font = `${obj.fontSize}px ${obj.fontFamily}`;
                ctx.fillText(obj.text, obj.x, obj.y);
                break;
        }
        ctx.globalAlpha = 1.0;
        if (selectedObjectIds.has(obj.id)) {
            const bounds = getObjectBounds(obj);
            ctx.strokeStyle = '#007AFF';
            ctx.lineWidth = 1 / scale;
            ctx.strokeRect(bounds.x - 5, bounds.y - 5, bounds.width + 10, bounds.height + 10);
        }
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx || !canvas) return;
    
        // Clear canvas with white (or it becomes transparent)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    
        ctx.save();
        ctx.translate(offset.x, offset.y);
        ctx.scale(scale, scale);
    
        // Draw background color for the page
        ctx.fillStyle = pageColor;
        // Assuming a very large canvas size for "infinite" feel
        ctx.fillRect(-10000, -10000, 20000, 20000);
    
        // Draw background pattern if any
        if (note.background === 'grid') drawGrid(ctx, canvas.width, canvas.height);
        if (note.background === 'lines') drawLines(ctx, canvas.width, canvas.height);
    
        objects.forEach(obj => drawObject(ctx, obj));
        
        ctx.restore();
        
        if (selectionRect) {
            ctx.strokeStyle = 'rgba(0, 122, 255, 0.8)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 2]);
            ctx.strokeRect(selectionRect.x, selectionRect.y, selectionRect.width, selectionRect.height);
            ctx.setLineDash([]);
        }
    }, [objects, selectedObjectIds, selectionRect, note.background, scale, offset, pageColor]);
    
    const handleMouseDown = (e: React.MouseEvent) => {
        if (isInteracting.current) return;
        isInteracting.current = true;
        const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);
        const newHistoryState = [...objectsRef.current];
        addToHistory(newHistoryState);
        setIsDrawing(true);
        const newObjectId = `obj_${Date.now()}_${Math.random()}`;

        switch (activeTool) {
            case 'pen':
            case 'highlighter':
                setObjects([...objects, { id: newObjectId, type: 'path', points: [{ x, y }], x, y, color, strokeWidth, isHighlighter: activeTool === 'highlighter' }]);
                break;
            case 'rect':
                setObjects([...objects, { id: newObjectId, type: 'rect', x, y, width: 0, height: 0, color, strokeWidth }]);
                break;
            case 'line':
                setObjects([...objects, { id: newObjectId, type: 'line', x, y, x2: x, y2: y, color, strokeWidth }]);
                break;
            case 'text':
                const text = prompt('Enter text:');
                if (text) {
                    const canvas = canvasRef.current;
                    const ctx = canvas?.getContext('2d');
                    const fontSize = strokeWidth * 5 + 10;
                    let textWidth = 0;
                    if (ctx) {
                        ctx.font = `${fontSize}px ${activeFont}`;
                        textWidth = ctx.measureText(text).width;
                    }
                    setObjects([...objects, { id: newObjectId, type: 'text', text, x, y, width: textWidth, height: fontSize, color, strokeWidth, fontSize, fontFamily: activeFont }]);
                    addToHistory([...objectsRef.current, { id: newObjectId, type: 'text', text, x, y, width: textWidth, height: fontSize, color, strokeWidth, fontSize, fontFamily: activeFont }]);
                }
                break;
            case 'select':
                setMovingStartPoint({ x, y });
                setSelectionRect({ x, y, width: 0, height: 0});
                break;
            case 'eraser':
                 const newObjects = objects.filter(obj => !isPointInRect({ x, y }, getObjectBounds(obj)));
                 setObjects(newObjects);
                break;
        }
    };
    const handleMouseMove = (e: React.MouseEvent) => { /* ... implementation for mouse drawing ... */ };
    const handleMouseUp = (e: React.MouseEvent) => { /* ... implementation for mouse drawing ... */ };
    
    const handleDoubleClick = useCallback((e: React.MouseEvent) => {
        if (activeTool !== 'select') return;
        const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);
        const clickedObject = objects.slice().reverse().find(obj => obj.type === 'text' && isPointInRect({ x, y }, getObjectBounds(obj)));
        
        if (clickedObject && clickedObject.type === 'text') {
            const newText = prompt('Enter new text:', (clickedObject as TextObject).text);
            if (newText !== null) {
                const updatedObjects = objects.map(obj => {
                    if (obj.id === clickedObject.id) {
                        const canvas = canvasRef.current;
                        const ctx = canvas?.getContext('2d');
                        let newWidth = (obj as TextObject).width;
                        if (ctx) {
                            ctx.font = `${(obj as TextObject).fontSize}px ${(obj as TextObject).fontFamily}`;
                            newWidth = ctx.measureText(newText).width;
                        }
                        return { ...obj, text: newText, width: newWidth };
                    }
                    return obj;
                });
                setObjects(updatedObjects);
                addToHistory(updatedObjects);
            }
        }
    }, [activeTool, objects, scale, offset, addToHistory]);
    
    const handleTouchStart = (e: React.TouchEvent) => { /* ... implementation for touch events ... */ };
    const handleTouchMove = (e: React.TouchEvent) => { /* ... implementation for touch events ... */ };
    const handleTouchEnd = (e: React.TouchEvent) => { /* ... implementation for touch events ... */ };
    const handleWheel = (e: React.WheelEvent) => { /* ... implementation for wheel zoom ... */ };

    const tools = [
        { id: 'select', label: 'Select', icon: <MousePointer/> },
        { id: 'pen', label: 'Pen', icon: <Pen/> },
        { id: 'highlighter', label: 'Highlighter', icon: <Highlighter/> },
        { id: 'eraser', label: 'Eraser', icon: <Eraser/> },
    ];
    const shapeTools = [
        { id: 'line', label: 'Line', icon: <Minus/> },
        { id: 'rect', label: 'Rectangle', icon: <Square/> },
    ];
    const textTools = [
         { id: 'text', label: 'Text', icon: <TypeIcon/> }
    ];
    const actionTools = [
        { id: 'undo', label: 'Undo', action: undo, icon: <Undo/> },
        { id: 'redo', label: 'Redo', action: redo, icon: <Redo/> },
    ];
    const clipboardTools = [
        { id: 'cut', label: 'Cut', action: handleCut, icon: <Scissors/> },
        { id: 'copy', label: 'Copy', action: handleCopy, icon: <Copy/> },
        { id: 'paste', label: 'Paste', action: handlePaste, icon: <ClipboardPaste/> },
    ];

    return (
        <div className="fixed inset-0 bg-white z-40 flex flex-col">
            <header className="p-2 border-b flex justify-between items-center bg-gray-50 flex-shrink-0">
                <button onClick={handleClose} className="p-2 rounded-lg bg-gray-200 hover:bg-gray-300 font-semibold"><ArrowLeft size={20} /></button>
                <h2 className="font-bold text-lg truncate px-4">{note.title}</h2>
                <button onClick={() => saveNote(true)} className={`py-2 px-4 rounded-lg text-white font-bold ${getThemeClasses('bg')}`}>{t('save_note_button')}</button>
            </header>
            
            <div className="flex-shrink-0 bg-white/80 backdrop-blur-sm shadow-md z-10 overflow-hidden">
                 <div className="flex items-center gap-1 p-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                    {tools.map(tool => ( <button key={tool.id} onClick={() => setActiveTool(tool.id as any)} className={`p-2 rounded-lg transition-colors ${activeTool === tool.id ? getThemeClasses('bg-light') : 'hover:bg-gray-100'}`} title={tool.label}>{tool.icon}</button>))}
                    <div className="h-8 border-l mx-1"></div>
                    {shapeTools.map(tool => ( <button key={tool.id} onClick={() => setActiveTool(tool.id as any)} className={`p-2 rounded-lg transition-colors ${activeTool === tool.id ? getThemeClasses('bg-light') : 'hover:bg-gray-100'}`} title={tool.label}>{tool.icon}</button>))}
                    <div className="h-8 border-l mx-1"></div>
                    {textTools.map(tool => ( <button key={tool.id} onClick={() => setActiveTool(tool.id as any)} className={`p-2 rounded-lg transition-colors ${activeTool === tool.id ? getThemeClasses('bg-light') : 'hover:bg-gray-100'}`} title={tool.label}>{tool.icon}</button>))}
                     <select value={activeFont} onChange={e => setActiveFont(e.target.value)} className="p-1 rounded-lg border-gray-200 bg-transparent text-sm focus:ring-0 focus:border-gray-400">
                        {availableFonts.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                    <div className="h-8 border-l mx-1"></div>
                    <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-8 h-8 p-0 border-none bg-transparent rounded-md cursor-pointer" title="Stroke Color"/>
                    <input type="range" min="1" max="50" value={strokeWidth} onChange={e => setStrokeWidth(Number(e.target.value))} className="w-24" title="Stroke Width"/>
                    <label className="flex items-center gap-1 text-sm font-semibold p-2" title="Page Color">
                        <input type="color" value={pageColor} onChange={e => setPageColor(e.target.value)} className="w-8 h-8 p-0 border-none bg-transparent rounded-md cursor-pointer"/>
                    </label>
                    <div className="h-8 border-l mx-1"></div>
                    {actionTools.map(tool => ( <button key={tool.id} onClick={tool.action} className="p-2 rounded-lg hover:bg-gray-100" title={tool.label}>{tool.icon}</button>))}
                    <div className="h-8 border-l mx-1"></div>
                    {clipboardTools.map(tool => ( <button key={tool.id} onClick={tool.action} className="p-2 rounded-lg hover:bg-gray-100" title={tool.label}>{tool.icon}</button>))}
                    <button onClick={handleDeleteSelected} className="p-2 text-red-500 hover:bg-red-100 rounded-lg" title="Delete Selection"><Trash2/></button>
                </div>
            </div>

            <div className="flex-grow relative overflow-hidden">
                <canvas ref={canvasRef} width={window.innerWidth} height={window.innerHeight}
                    onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
                    onDoubleClick={handleDoubleClick}
                    onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} onWheel={handleWheel}
                    className="absolute top-0 left-0"
                />
            </div>
        </div>
    );
};


// ==================================
//      MAIN NOTES VIEW
// ==================================
const NotesView: React.FC<NotesViewProps> = ({ userId, user, t, tSubject, getThemeClasses, showAppModal, initialContext, onBack }) => {
  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const [filterSubject, setFilterSubject] = useState(initialContext?.note?.subject || 'all');
  const [activeNote, setActiveNote] = useState<Note | null>(initialContext?.note || null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  const userSubjects = useMemo(() => Array.from(new Set([...(user.selectedSubjects || []), ...(user.customSubjects || [])])), [user.selectedSubjects, user.customSubjects]);

  useEffect(() => {
    if (user.uid === 'guest-user') return;
    const q = db.collection(`users/${userId}/notes`).orderBy('updatedAt', 'desc');
    const unsub = q.onSnapshot(snap => setAllNotes(snap.docs.map(d => ({id: d.id, ...d.data()} as Note))), 
        err => showAppModal({text: `Error fetching notes: ${err.message}`}));
    return () => unsub();
  }, [userId, user.uid, showAppModal]);

  const notes = useMemo(() => {
    if (filterSubject === 'all') return allNotes;
    return allNotes.filter(note => note.subject === filterSubject);
  }, [allNotes, filterSubject]);

  const handleCreateNewNote = async (title: string, noteType: 'text' | 'drawing', background: Note['background'] = 'blank') => {
    const newNoteData: Omit<Note, 'id'> = {
        title,
        content: noteType === 'drawing' ? '[]' : '',
        subject: filterSubject === 'all' ? (userSubjects[0] || 'algemeen') : filterSubject,
        ownerId: userId,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        noteType: noteType,
        background: background,
        backgroundColor: '#FFFFFF',
    };
    const docRef = await db.collection(`users/${userId}/notes`).add(newNoteData);
    setShowCreateModal(false);
    setActiveNote({ id: docRef.id, ...newNoteData });
  };
  
  const handleNoteUpdate = useCallback((id: string, data: Partial<Note>) => {
      db.doc(`users/${userId}/notes/${id}`).update(data);
  }, [userId]);

  const handleDeleteNote = (id: string) => {
     showAppModal({ text: t('confirm_delete_note'),
      confirmAction: async () => {
        await db.doc(`users/${userId}/notes/${id}`).delete();
        showAppModal({ text: t('note_deleted_success') });
      },
      cancelAction: () => {}
    });
  }
  
  const inferNoteType = (note: Note) => {
    if (note.noteType) return note.noteType;
    try {
        if (note.content && note.content.trim().startsWith('[') && Array.isArray(JSON.parse(note.content))) {
            return 'drawing';
        }
    } catch(e) { /* ignore json parse error */ }
    return 'text';
  }

  if (activeNote) {
      const noteType = inferNoteType(activeNote);
      if (noteType === 'text') {
        return <TextNoteEditor note={activeNote} onBack={() => setActiveNote(null)} t={t} getThemeClasses={getThemeClasses} showAppModal={showAppModal} user={user} />;
      }
      return <NoteEditor note={activeNote} onClose={() => setActiveNote(null)} onNoteUpdate={handleNoteUpdate} t={t} getThemeClasses={getThemeClasses} />;
  }

  return (
    <div>
        <div className="flex items-center mb-4">
            {onBack && <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-200 transition-colors"><ArrowLeft/></button>}
            <h3 className={`font-bold text-xl flex-grow text-center ${getThemeClasses('text-strong')}`}>{t('notes')}</h3>
            <div className="w-9 h-9"></div> {/* Placeholder for centering */}
        </div>
        <div className={`p-4 rounded-lg shadow-inner ${getThemeClasses('bg-light')} space-y-4`}>
        {showCreateModal && <NoteCreationModal onClose={() => setShowCreateModal(false)} onCreate={handleCreateNewNote} t={t} getThemeClasses={getThemeClasses} />}
        <div className="flex justify-between items-center flex-wrap gap-2">
                <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)} className="p-2 border rounded-lg bg-white shadow-sm font-semibold">
                    <option value="all">{t('all_subjects_option')}</option>
                    {userSubjects.map(s => <option key={s} value={s}>{tSubject(s)}</option>)}
                </select>
                <button onClick={() => setShowCreateModal(true)} className={`flex items-center text-white font-bold py-2 px-4 rounded-lg shadow-md ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')}`}>
                    <PlusCircle className="w-5 h-5 mr-2"/> {t('add_note_button')}
                </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {notes.length === 0 ? (
                    <p className="text-center italic text-gray-500 py-8 md:col-span-2 lg:col-span-3">{t('no_notes_found')}</p>
                ) : (
                    notes.map(note => (
                        <div key={note.id} className={`bg-white rounded-xl shadow-md flex flex-col border-l-4 ${getThemeClasses('border')}`}>
                            <div className="p-4 flex-grow">
                                <div className="flex items-center gap-2 mb-2">
                                    {inferNoteType(note) === 'drawing' 
                                        ? <NotebookPen className={`w-5 h-5 ${getThemeClasses('text')} flex-shrink-0`} /> 
                                        : <FileText className={`w-5 h-5 ${getThemeClasses('text')} flex-shrink-0`} />
                                    }
                                    <h4 className="font-bold text-lg truncate">{note.title}</h4>
                                </div>
                                <p className={`text-xs font-semibold uppercase tracking-wider ${getThemeClasses('text')}`}>{tSubject(note.subject)}</p>
                                <p className="text-xs text-gray-400 mt-1">{(note.updatedAt as any)?.toDate().toLocaleDateString()}</p>
                            </div>
                            <div className="bg-gray-50 px-4 py-2 flex justify-end gap-2 rounded-b-lg">
                                <button onClick={() => handleDeleteNote(note.id)} className="p-2 text-red-500 hover:bg-red-100 rounded-full"><Trash2 size={16}/></button>
                                <button onClick={() => setActiveNote(note)} className={`flex items-center gap-2 font-semibold text-sm ${getThemeClasses('text')} hover:opacity-80`}><Edit size={16}/> {t('edit_note')}</button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    </div>
  );
};

export default NotesView;
