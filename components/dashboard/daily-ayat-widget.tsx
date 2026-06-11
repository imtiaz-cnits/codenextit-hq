"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { BookOpenCheck, Sparkles, Award, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";

// Import local JSON databases
import quranDataRaw from "../../lib/data/quran.json";
import hadithDataRaw from "../../lib/data/hadiths.json";

interface QuranVerse {
  id: number;
  chapter: number;
  verse: number;
  surah: string;
  surahEn: string;
  verseNo: string;
  verseNoEn: string;
  arabic: string;
  bangla: string;
}

interface Hadith {
  id: number;
  source: string;
  sourceEn: string;
  arabic: string;
  bangla: string;
  lesson: string;
}

const QURAN_VERSES = quranDataRaw as QuranVerse[];
const HADITHS = hadithDataRaw as Hadith[];

export function DailyAyatWidget() {
  const [mounted, setMounted] = useState(false);
  const [isTafsirOpen, setIsTafsirOpen] = useState(false);
  const [tafsir, setTafsir] = useState<string>("");
  const [loadingTafsir, setLoadingTafsir] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Calculate verse starting from June 12, 2026 as index 0
  const today = new Date();
  const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startDate = new Date(2026, 5, 12); // June 12, 2026 (Month is 0-indexed: 5 = June)
  const diffTime = todayLocal.getTime() - startDate.getTime();
  const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

  // Make sure we handle empty data safely
  const verse = QURAN_VERSES.length > 0 ? QURAN_VERSES[diffDays % QURAN_VERSES.length] : null;

  // Dynamic Tafsir loading when popup is opened
  useEffect(() => {
    if (isTafsirOpen && verse && !tafsir) {
      setLoadingTafsir(true);
      fetch(`https://api.quran.com/api/v4/tafsirs/166/by_ayah/${verse.verseNoEn}`)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch Tafsir");
          return res.json();
        })
        .then((data) => {
          if (data.tafsir && data.tafsir.text) {
            // Remove HTML tags from API response
            const cleanText = data.tafsir.text
              .replace(/<[^>]*>/g, "")
              .replace(/&nbsp;/g, " ")
              .replace(/\s+/g, " ")
              .trim();
            setTafsir(cleanText);
          } else {
            setTafsir("তাফসীর পাওয়া যায়নি।");
          }
        })
        .catch((err) => {
          console.error(err);
          setTafsir("তাফসীর লোড করার সময় সমস্যা হয়েছে। দয়া করে ইন্টারনেট কানেকশন চেক করুন।");
        })
        .finally(() => {
          setLoadingTafsir(false);
        });
    }
  }, [isTafsirOpen, verse, tafsir]);

  if (!mounted || !verse) {
    return (
      <Card className="w-full border-2 border-primary/10 overflow-hidden bg-card/45 backdrop-blur-sm shadow-sm animate-pulse">
        <CardContent className="p-4 h-[120px] flex items-center justify-center font-bengali">
          <span className="text-xs text-muted-foreground">লোডিং...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="w-full border-2 border-primary/10 overflow-hidden bg-card/45 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-300 rounded-xl font-bengali">
        <CardContent className="p-4 space-y-3">
          {/* Widget Header */}
          <div className="flex items-center justify-between pb-1 border-b border-primary/10">
            <div className="flex items-center gap-1.5 text-primary">
              <BookOpenCheck className="h-4 w-4 shrink-0" />
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1 font-bengali">
                আজকের আয়াত
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-semibold bg-primary/5 px-2 py-0.5 rounded-full">
              <Sparkles className="h-2.5 w-2.5 text-primary shrink-0" />
              <span>{verse.surahEn} {verse.verseNoEn}</span>
            </div>
          </div>

          {/* Arabic text with improved clarity and font sizing */}
          <div className="py-1">
            <p
              className="text-right text-[24px] font-normal leading-loose text-foreground tracking-normal antialiased select-all selection:bg-primary/20"
              dir="rtl"
              style={{ fontFamily: "'Amiri', 'Noto Naskh Arabic', serif" }}
            >
              {verse.arabic}
            </p>
          </div>

          {/* Bangla translation */}
          <div>
            <p className="text-xs md:text-sm text-muted-foreground leading-relaxed text-left border-l-2 border-primary/30 pl-3 py-0.5 font-bengali">
              {verse.bangla}
            </p>
          </div>

          {/* Action / Toggle footer */}
          <div className="flex justify-between items-center pt-2 border-t border-dashed border-border/60 font-bengali">
            <span className="text-[10px] text-muted-foreground/80 font-bengali">
              সূরা: {verse.surah} • আয়াত: {verse.verseNo} • সিরিয়াল: {verse.id}/{QURAN_VERSES.length}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsTafsirOpen(true)}
              className="h-7 px-2.5 text-xs text-primary hover:bg-primary/5 hover:text-primary transition-all font-semibold flex items-center gap-1 cursor-pointer rounded-lg"
            >
              <span className="font-bengali">তাফসীর দেখুন</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isTafsirOpen} onOpenChange={setIsTafsirOpen}>
        <DialogContent className="max-w-xl font-bengali">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-primary font-bengali">
              <BookOpenCheck className="h-5 w-5" />
              তাফসীর (আবু বকর যাকারিয়া)
            </DialogTitle>
            <DialogDescription className="text-xs font-bengali">
              সূরা: {verse.surahEn} ({verse.surah}) • আয়াত: {verse.verseNo}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 p-4 bg-primary/[0.03] dark:bg-primary/[0.01] border border-primary/10 rounded-xl max-h-[60vh] overflow-y-auto scrollbar-thin">
            {loadingTafsir ? (
              <p className="italic text-muted-foreground animate-pulse text-[16px] font-bengali text-center py-6">তাফসীর লোড হচ্ছে...</p>
            ) : (
              <p className="font-bengali text-[16px] leading-relaxed text-foreground whitespace-pre-line select-text">
                {tafsir}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function DailyHadithWidget() {
  const [mounted, setMounted] = useState(false);
  const [isLessonOpen, setIsLessonOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Card className="w-full border-2 border-primary/10 overflow-hidden bg-card/45 backdrop-blur-sm shadow-sm animate-pulse">
        <CardContent className="p-4 h-[120px] flex items-center justify-center font-bengali">
          <span className="text-xs text-muted-foreground">লোডিং...</span>
        </CardContent>
      </Card>
    );
  }

  // Calculate Hadith starting from June 12, 2026 as index 0
  const today = new Date();
  const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startDate = new Date(2026, 5, 12); // June 12, 2026 (Month is 0-indexed: 5 = June)
  const diffTime = todayLocal.getTime() - startDate.getTime();
  const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

  const hadith = HADITHS.length > 0 ? HADITHS[diffDays % HADITHS.length] : null;

  if (!hadith) return null;

  return (
    <>
      <Card className="w-full border-2 border-primary/10 overflow-hidden bg-card/45 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-300 rounded-xl font-bengali">
        <CardContent className="p-4 space-y-3">
          {/* Widget Header */}
          <div className="flex items-center justify-between pb-1 border-b border-primary/10">
            <div className="flex items-center gap-1.5 text-primary">
              <Award className="h-4 w-4 shrink-0" />
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1 font-bengali">
                আজকের হাদিস
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-semibold bg-primary/5 px-2 py-0.5 rounded-full">
              <Sparkles className="h-2.5 w-2.5 text-primary shrink-0" />
              <span>{hadith.sourceEn.split(",")[0]}</span>
            </div>
          </div>

          {/* Arabic text with improved clarity and font sizing */}
          <div className="py-1">
            <p
              className="text-right text-[24px] font-normal leading-loose text-foreground tracking-normal antialiased select-all selection:bg-primary/20"
              dir="rtl"
              style={{ fontFamily: "'Amiri', 'Noto Naskh Arabic', serif" }}
            >
              {hadith.arabic}
            </p>
          </div>

          {/* Bangla translation */}
          <div>
            <p className="text-xs md:text-sm text-muted-foreground leading-relaxed text-left border-l-2 border-primary/30 pl-3 py-0.5 font-bengali">
              {hadith.bangla}
            </p>
          </div>

          {/* Action / Toggle footer */}
          <div className="flex justify-between items-center pt-2 border-t border-dashed border-border/60 font-bengali">
            <span className="text-[10px] text-muted-foreground/80 font-bengali">
              উৎস: {hadith.source} • সিরিয়াল: {hadith.id}/{HADITHS.length}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsLessonOpen(true)}
              className="h-7 px-2.5 text-xs text-primary hover:bg-primary/5 hover:text-primary transition-all font-semibold flex items-center gap-1 cursor-pointer rounded-lg"
            >
              <span className="font-bengali">শিক্ষা ও তাৎপর্য</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isLessonOpen} onOpenChange={setIsLessonOpen}>
        <DialogContent className="max-w-xl font-bengali">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-primary font-bengali">
              <Award className="h-5 w-5" />
              শিক্ষা ও তাৎপর্য
            </DialogTitle>
            <DialogDescription className="text-xs font-bengali">
              উৎস: {hadith.source}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 p-4 bg-primary/[0.03] dark:bg-primary/[0.01] border border-primary/10 rounded-xl max-h-[60vh] overflow-y-auto scrollbar-thin">
            <p className="font-bengali text-[16px] leading-relaxed text-foreground select-text whitespace-pre-line">
              {hadith.lesson}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
