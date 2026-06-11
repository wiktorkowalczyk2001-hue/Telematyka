import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import * as Speech from 'expo-speech';
import Animated, {
  FadeInDown, FadeInLeft, FadeInRight, ZoomIn,
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { sendMessage, runDemoStep } from '@/src/services/aiAssistantService';
import { useColors } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';

type StreamState = 'idle' | 'streaming' | 'tool_executing';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolsUsed?: string[];
  loading?: boolean;
  streaming?: boolean;
};

function TypingDots() {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  return (
    <View style={{ flexDirection: 'row', gap: 4, padding: 4 }}>
      {[0, 1, 2].map(i => (
        <Animated.View key={i} entering={ZoomIn.delay(i * 120)} style={styles.dot} />
      ))}
    </View>
  );
}

function MessageBubble({ msg, streamState, streamedText, toolLabel }: {
  msg: Message;
  streamState?: StreamState;
  streamedText?: string;
  toolLabel?: string;
}) {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const isUser = msg.role === 'user';

  let bodyContent: React.ReactNode;
  if (msg.loading) {
    if (streamState === 'tool_executing') {
      bodyContent = (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ActivityIndicator size="small" color={C.accent} />
          <Text style={[styles.bubbleText, { color: C.accent, fontStyle: 'italic', fontSize: 13 }]}>
            {toolLabel || 'Przetwarzam…'}
          </Text>
        </View>
      );
    } else if (streamState === 'streaming' && streamedText) {
      bodyContent = (
        <Text style={styles.bubbleText}>{streamedText}<Text style={{ opacity: 0.4 }}>▌</Text></Text>
      );
    } else {
      bodyContent = <TypingDots />;
    }
  } else {
    bodyContent = (
      <>
        <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{msg.content}</Text>
        {msg.toolsUsed && msg.toolsUsed.length > 0 && (
          <View style={styles.toolsRow}>
            {msg.toolsUsed.map(t => (
              <Text key={t} style={styles.toolBadge}>{t}</Text>
            ))}
          </View>
        )}
      </>
    );
  }

  return (
    <Animated.View
      entering={isUser ? FadeInRight.springify().damping(18) : FadeInLeft.springify().damping(18)}
      style={[styles.bubbleWrap, isUser && styles.bubbleWrapUser]}
    >
      {!isUser && (
        <View style={styles.aiAvatar}>
          <Text style={styles.aiAvatarText}>AI</Text>
        </View>
      )}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}>
        {bodyContent}
      </View>
    </Animated.View>
  );
}

let WebSpeechRecognition: any = null;
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  WebSpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
}

function getBestPolishVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const pl = voices.filter(v => v.lang.startsWith('pl'));
  if (!pl.length) return null;
  return (
    pl.find(v => v.name.toLowerCase().includes('google')) ??
    pl.find(v => v.name.toLowerCase().includes('microsoft')) ??
    pl.find(v => v.localService === false) ??
    pl[0]
  );
}

export default function AIAssistantScreen() {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const router = useRouter();
  const { user } = useAuth() as any;

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: 'Cześć! Mogę umówić wizytę, sprawdzić harmonogram lub odpowiedzieć na pytania o pacjentów.',
    },
  ]);
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [streamState, setStreamState] = useState<StreamState>('idle');
  const [streamedText, setStreamedText] = useState('');
  const [toolLabel, setToolLabel] = useState('');

  const scrollRef = useRef<ScrollView>(null);
  const recognitionRef = useRef<any>(null);
  // -1 = normal mode; 0-3 = demo step to execute next
  const demoStepRef = useRef<number>(-1);
  const micScale = useSharedValue(1);
  const micStyle = useAnimatedStyle(() => ({ transform: [{ scale: micScale.value }] }));

  const scrollToBottom = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }, []);

  const stopSpeech = useCallback(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.speechSynthesis?.cancel();
    } else {
      Speech.stop();
    }
  }, []);

  const speak = useCallback((text: string) => {
    if (!ttsEnabled) return;
    const clean = text
      .replace(/\[ACTION:[^\]]*\]/g, '')
      .replace(/[*_`#✓]/g, '')
      .replace(/\n+/g, '. ')
      .trim();
    if (!clean) return;

    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.speechSynthesis) {
      // Cancel any current speech and resume suspended AudioContext (Chrome Android fix)
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();

      const utter = new SpeechSynthesisUtterance(clean);
      utter.lang = 'pl-PL';
      utter.rate = 0.9;
      utter.pitch = 1.05;

      const doSpeak = () => {
        const voice = getBestPolishVoice();
        if (voice) utter.voice = voice;
        // Chrome Android bug: speechSynthesis silently stops after ~15s
        // Workaround: periodic resume() while speaking
        const keepAlive = setInterval(() => {
          if (window.speechSynthesis.speaking) {
            window.speechSynthesis.pause();
            window.speechSynthesis.resume();
          } else {
            clearInterval(keepAlive);
          }
        }, 10000);
        utter.onend = () => clearInterval(keepAlive);
        utter.onerror = () => clearInterval(keepAlive);
        window.speechSynthesis.speak(utter);
      };

      if (window.speechSynthesis.getVoices().length > 0) {
        doSpeak();
      } else {
        window.speechSynthesis.onvoiceschanged = doSpeak;
      }
      return;
    }

    Speech.stop();
    Speech.speak(clean, { language: 'pl-PL', pitch: 1.05, rate: 0.9, onError: () => {} });
  }, [ttsEnabled]);

  const sendToAI = useCallback(async (userText: string) => {
    if (!userText.trim() || isSending) return;
    stopSpeech();
    setInput('');
    setIsSending(true);
    setStreamState('idle');
    setStreamedText('');
    setToolLabel('');

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: userText };
    const loadingId = 'loading-' + Date.now();
    const loadingMsg: Message = { id: loadingId, role: 'assistant', content: '', loading: true };

    setMessages(prev => [...prev, userMsg, loadingMsg]);
    scrollToBottom();

    // Skip the synthetic welcome message (id '0') — it's UI-only, not a real AI turn
    const history = messages
      .filter(m => !m.loading && m.id !== '0')
      .map(m => ({ role: m.role, content: m.content }));

    try {
      const callbacks = {
        onToken: (text: string) => {
          setStreamState('streaming');
          setStreamedText(text);
          scrollToBottom();
        },
        onTool: (label: string) => {
          setStreamState('tool_executing');
          setToolLabel(label);
          setStreamedText('');
          scrollToBottom();
        },
      };
      const ctx = { doctorId: user?.id };

      // Demo mode: "hej" activates step 0; each subsequent message advances one step.
      // Steps 0-3 use real DB calls but scripted AI text. Step 4+ exits demo mode.
      if (userText.trim().toLowerCase() === 'hej' && demoStepRef.current === -1) {
        demoStepRef.current = 0;
      }

      let result;
      if (demoStepRef.current >= 0) {
        const currentStep = demoStepRef.current;
        demoStepRef.current = currentStep < 3 ? currentStep + 1 : -1;
        result = await runDemoStep(currentStep, callbacks, ctx);
      } else {
        result = await sendMessage([...history, { role: 'user', content: userText }], callbacks, ctx);
      }

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.content,
        toolsUsed: result.toolsUsed,
      };

      setStreamState('idle');
      setStreamedText('');
      setToolLabel('');
      setMessages(prev => [...prev.filter(m => m.id !== loadingId), aiMsg]);
      scrollToBottom();
      speak(result.content);
    } catch (e: any) {
      const isCors = e.message?.includes('Failed to fetch') || e.message?.includes('NetworkError');
      setStreamState('idle');
      setStreamedText('');
      setToolLabel('');
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: isCors
          ? 'Nie mogę połączyć się z LM Studio.\n\nSprawdź czy serwer LM Studio działa, model jest załadowany, a w ustawieniach serwera włączone jest "Allow CORS".'
          : `Błąd: ${e.message}`,
      };
      setMessages(prev => [...prev.filter(m => m.id !== loadingId), errMsg]);
      scrollToBottom();
    } finally {
      setIsSending(false);
    }
  }, [isSending, messages, speak, stopSpeech, scrollToBottom, user?.id]);

  const startListening = useCallback(async () => {
    if (Platform.OS !== 'web') {
      Alert.alert('Mikrofon', 'STT działa w przeglądarce Chrome (HTTPS).');
      return;
    }
    if (!WebSpeechRecognition) {
      Alert.alert('STT niedostępne', 'Web Speech API wymaga Chrome.');
      return;
    }

    // Request mic permission explicitly — triggers browser permission dialog
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Stop the stream immediately, we just needed the permission grant
        stream.getTracks().forEach(t => t.stop());
      } catch (err: any) {
        Alert.alert('Mikrofon zablokowany', 'Zezwól na dostęp do mikrofonu w ustawieniach przeglądarki, a następnie odśwież stronę.');
        return;
      }
    }

    try {
      const rec = new WebSpeechRecognition();
      rec.lang = 'pl-PL';
      rec.interimResults = false;
      rec.maxAlternatives = 1;

      rec.onstart = () => {
        setIsListening(true);
        micScale.value = withRepeat(
          withSequence(withTiming(1.25, { duration: 350 }), withTiming(1, { duration: 350 })),
          -1,
        );
      };
      rec.onresult = (e: any) => {
        const transcript = e.results[0][0].transcript;
        setInput(transcript);
        stopListening();
        sendToAI(transcript);
      };
      rec.onerror = (e: any) => {
        if (e.error === 'not-allowed') {
          Alert.alert('Mikrofon zablokowany', 'Zezwól na dostęp do mikrofonu i odśwież stronę.');
        } else if (e.error === 'no-speech') {
          // silently stop — user didn't say anything
        } else {
          Alert.alert('Błąd STT', `${e.error}`);
        }
        stopListening();
      };
      rec.onend = () => stopListening();
      rec.start();
      recognitionRef.current = rec;
    } catch {
      Alert.alert('Błąd STT', 'Nie można uruchomić rozpoznawania mowy. Wymagane HTTPS i Chrome.');
    }
  }, [sendToAI]);

  const stopListening = useCallback(() => {
    setIsListening(false);
    micScale.value = withTiming(1);
    recognitionRef.current?.stop();
    recognitionRef.current = null;
  }, []);

  const handleMic = () => {
    if (isListening) stopListening();
    else startListening();
  };

  const loadingId = messages.find(m => m.loading)?.id;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Animated.View entering={FadeInDown.springify()} style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.headerInfo}>
          <View style={styles.statusDot} />
          <Text style={styles.headerTitle}>Asystent AI</Text>
        </View>
        <Pressable
          onPress={() => setTtsEnabled(v => !v)}
          style={styles.headerBtn}
          accessibilityLabel={ttsEnabled ? 'Wyłącz głos' : 'Włącz głos'}
        >
          <Text style={[styles.headerBtnText, !ttsEnabled && styles.headerBtnOff]}>
            {ttsEnabled ? '🔊' : '🔇'}
          </Text>
        </Pressable>
        <Pressable onPress={stopSpeech} style={styles.headerBtn}>
          <Text style={styles.headerBtnText}>⏹</Text>
        </Pressable>
      </Animated.View>

      <ScrollView
        ref={scrollRef}
        style={styles.chatArea}
        contentContainerStyle={styles.chatContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {messages.map(msg => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            streamState={msg.id === loadingId ? streamState : undefined}
            streamedText={msg.id === loadingId ? streamedText : undefined}
            toolLabel={msg.id === loadingId ? toolLabel : undefined}
          />
        ))}
        <View style={{ height: 16 }} />
      </ScrollView>

      <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.inputBar}>
        <Pressable onPress={handleMic} style={[styles.micBtn, isListening && styles.micBtnActive]}>
          <Animated.View style={[styles.micPressable, micStyle]}>
            <Text style={styles.micIcon}>{isListening ? '⏹' : '🎤'}</Text>
          </Animated.View>
        </Pressable>

        <TextInput
          style={styles.textInput}
          value={input}
          onChangeText={setInput}
          placeholder="Napisz lub naciśnij mikrofon…"
          placeholderTextColor={C.dim}
          multiline
          maxLength={400}
          onSubmitEditing={() => sendToAI(input)}
          blurOnSubmit={false}
        />

        <Pressable
          onPress={() => sendToAI(input)}
          disabled={!input.trim() || isSending}
          style={({ pressed }) => [
            styles.sendBtn,
            (!input.trim() || isSending) && styles.sendBtnDisabled,
            pressed && { opacity: 0.8 },
          ]}
        >
          {isSending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.sendIcon}>↑</Text>
          )}
        </Pressable>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(C: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 54,
      backgroundColor: '#080F1A',
      borderBottomWidth: 1,
      borderBottomColor: C.border,
      paddingHorizontal: 12,
      gap: 8,
    },
    backBtn: { padding: 8 },
    backText: { fontSize: 24, color: C.accent, lineHeight: 28 },
    headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
    statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.accent },
    headerTitle: { fontSize: 16, fontWeight: '700', color: C.text },
    headerBtn: { padding: 8 },
    headerBtnText: { fontSize: 18 },
    headerBtnOff: { opacity: 0.4 },
    chatArea: { flex: 1 },
    chatContent: { padding: 14, paddingTop: 16 },
    bubbleWrap: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
      marginBottom: 12,
    },
    bubbleWrapUser: { flexDirection: 'row-reverse' },
    aiAvatar: {
      width: 30,
      height: 30,
      borderRadius: 9,
      backgroundColor: C.accentDim,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    aiAvatarText: { fontSize: 9, fontWeight: '700', color: C.accent },
    bubble: { maxWidth: '80%', borderRadius: 16, padding: 12 },
    bubbleAI: {
      backgroundColor: C.aiBubble,
      borderWidth: 1,
      borderColor: C.border,
      borderBottomLeftRadius: 4,
    },
    bubbleUser: {
      backgroundColor: C.userBubble,
      borderWidth: 1,
      borderColor: C.accentDim,
      borderBottomRightRadius: 4,
    },
    bubbleText: { fontSize: 14, color: C.text, lineHeight: 20 },
    bubbleTextUser: { color: '#C8EDE8' },
    toolsRow: { marginTop: 8, gap: 4 },
    toolBadge: { fontSize: 10, color: C.accent, opacity: 0.8 },
    dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.accent, opacity: 0.6 },
    inputBar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      padding: 10,
      paddingBottom: Platform.OS === 'ios' ? 28 : 10,
      backgroundColor: '#080F1A',
      borderTopWidth: 1,
      borderTopColor: C.border,
      gap: 8,
    },
    micBtn: {
      width: 42,
      height: 42,
      borderRadius: 13,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    micBtnActive: { backgroundColor: C.accentDim, borderColor: C.accent },
    micPressable: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
    micIcon: { fontSize: 18 },
    textInput: {
      flex: 1,
      backgroundColor: C.surface,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: C.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: C.text,
      maxHeight: 100,
    },
    sendBtn: {
      width: 42,
      height: 42,
      borderRadius: 13,
      backgroundColor: C.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendBtnDisabled: { backgroundColor: C.border },
    sendIcon: { fontSize: 18, color: '#fff', fontWeight: '700' },
  });
}
