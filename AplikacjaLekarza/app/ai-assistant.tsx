import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import * as Speech from 'expo-speech';
import Animated, { FadeInDown, FadeInLeft, FadeInRight, ZoomIn, useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { sendMessage } from '@/src/services/aiAssistantService';
import { useColors } from '@/src/context/ThemeContext';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolsUsed?: string[];
  loading?: boolean;
};


function TypingDots() {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  return (
    <View style={{ flexDirection: 'row', gap: 4, padding: 4 }}>
      {[0, 1, 2].map(i => (
        <Animated.View
          key={i}
          entering={ZoomIn.delay(i * 100)}
          style={[styles.dot, { opacity: 0.4 + i * 0.2 }]}
        />
      ))}
    </View>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const isUser = msg.role === 'user';
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
        {msg.loading ? (
          <TypingDots />
        ) : (
          <>
            <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
              {msg.content}
            </Text>
            {msg.toolsUsed && msg.toolsUsed.length > 0 && (
              <View style={styles.toolsRow}>
                {msg.toolsUsed.map(t => (
                  <Text key={t} style={styles.toolBadge}>{t}</Text>
                ))}
              </View>
            )}
          </>
        )}
      </View>
    </Animated.View>
  );
}

let SpeechRecognition: any = null;
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
}

export default function AIAssistantScreen() {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: 'Cześć! Jestem Twoim asystentem medycznym. Mogę umówić wizytę, sprawdzić harmonogram lub odpowiedzieć na pytania o pacjentów. Jak mogę pomóc?',
    },
  ]);
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const recognitionRef = useRef<any>(null);

  const micScale = useSharedValue(1);
  const micStyle = useAnimatedStyle(() => ({
    transform: [{ scale: micScale.value }],
  }));

  const scrollToBottom = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  const speak = async (text: string) => {
    await Speech.stop();
    const clean = text.replace(/\[ACTION:[^\]]*\]/g, '').replace(/[*_`#]/g, '').trim();
    if (!clean) return;
    Speech.speak(clean, {
      language: 'pl-PL',
      pitch: 1.0,
      rate: 0.95,
      onError: () => {},
    });
  };

  const sendToAI = async (userText: string) => {
    if (!userText.trim() || isSending) return;
    Speech.stop();
    setInput('');
    setIsSending(true);

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: userText };
    const loadingMsg: Message = { id: 'loading', role: 'assistant', content: '', loading: true };

    setMessages(prev => [...prev, userMsg, loadingMsg]);
    scrollToBottom();

    const history = messages
      .filter(m => !m.loading)
      .map(m => ({ role: m.role, content: m.content }));

    try {
      const result = await sendMessage([...history, { role: 'user', content: userText }]);

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.content,
        toolsUsed: result.toolsUsed,
      };

      setMessages(prev => [...prev.filter(m => m.id !== 'loading'), aiMsg]);
      scrollToBottom();
      speak(result.content);
    } catch (e: any) {
      const isCors = e.message?.includes('Failed to fetch') || e.message?.includes('NetworkError');
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: isCors
          ? 'Błąd CORS — przeglądarka blokuje połączenie z LM Studio.\n\nW LM Studio: Server → ⚙️ → włącz "Allow CORS" i uruchom ponownie serwer.'
          : `Błąd LM Studio: ${e.message}`,
      };
      setMessages(prev => [...prev.filter(m => m.id !== 'loading'), errMsg]);
      scrollToBottom();
    } finally {
      setIsSending(false);
    }
  };

  const startListening = () => {
    if (Platform.OS === 'web') {
      if (!SpeechRecognition) {
        Alert.alert('STT', 'Web Speech API niedostępne w tej przeglądarce.');
        return;
      }
      const rec = new SpeechRecognition();
      rec.lang = 'pl-PL';
      rec.interimResults = false;
      rec.onstart = () => {
        setIsListening(true);
        micScale.value = withRepeat(withSequence(withTiming(1.2, { duration: 400 }), withTiming(1, { duration: 400 })), -1);
      };
      rec.onresult = (e: any) => {
        const transcript = e.results[0][0].transcript;
        setInput(transcript);
        stopListening();
        sendToAI(transcript);
      };
      rec.onerror = () => stopListening();
      rec.onend = () => stopListening();
      rec.start();
      recognitionRef.current = rec;
    } else {
      Alert.alert('Mikrofon', 'STT działa na fizycznym urządzeniu Android. W Expo Go naciśnij mikrofon po zainstalowaniu buildu.');
    }
  };

  const stopListening = () => {
    setIsListening(false);
    micScale.value = withTiming(1);
    recognitionRef.current?.stop();
    recognitionRef.current = null;
  };

  const handleMic = () => {
    if (isListening) stopListening();
    else startListening();
  };

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
        <Pressable onPress={() => Speech.stop()} style={styles.stopSpeechBtn}>
          <Text style={styles.stopSpeechText}>■</Text>
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
          <MessageBubble key={msg.id} msg={msg} />
        ))}
        <View style={{ height: 16 }} />
      </ScrollView>

      <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.inputBar}>
        <Animated.View style={[styles.micBtn, isListening && styles.micBtnActive, micStyle]}>
          <Pressable onPress={handleMic} style={styles.micPressable}>
            <Text style={styles.micIcon}>{isListening ? '⏹' : '🎤'}</Text>
          </Pressable>
        </Animated.View>

        <TextInput
          style={styles.textInput}
          value={input}
          onChangeText={setInput}
          placeholder="Napisz lub naciśnij mikrofon..."
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

function makeStyles(C: any) { return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 54,
    backgroundColor: '#080F1A',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingHorizontal: 12,
    gap: 10,
  },
  backBtn: { padding: 8 },
  backText: { fontSize: 24, color: C.accent, lineHeight: 28 },
  headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.accent },
  headerTitle: { fontSize: 16, fontWeight: '700', color: C.text },
  stopSpeechBtn: { padding: 8 },
  stopSpeechText: { fontSize: 14, color: C.muted },
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
  bubble: {
    maxWidth: '80%',
    borderRadius: 16,
    padding: 12,
  },
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
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.accent },
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
}); }
