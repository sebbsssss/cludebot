import { Button } from "./ui/button.tsx"
import { Textarea } from "./ui/textarea.tsx"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select.tsx"
import { Brain, Link, Folder, Mic, Send } from "lucide-react"
import { LiquidMetal, PulsingBorder } from "@paper-design/shaders-react"
import { motion, AnimatePresence } from "framer-motion"
import { useState, useRef, useEffect } from "react"

interface Message {
  id: string
  content: string
  role: "user" | "assistant"
  timestamp: Date
}

const mockResponses = [
  "I'd be happy to help you with that! Based on what you've shared, here's what I think would work best...",
  "That's an interesting question. Let me break this down for you step by step.",
  "Great thinking! Here's my perspective on this topic...",
  "I understand what you're looking for. Here's a detailed explanation...",
  "Thanks for asking! This is actually a fascinating topic. Let me explain...",
]

export function ChatInterface() {
  const [isFocused, setIsFocused] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async () => {
    if (!inputValue.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue.trim(),
      role: "user",
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue("")
    setIsTyping(true)

    // Simulate AI response delay
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: mockResponses[Math.floor(Math.random() * mockResponses.length)],
        role: "assistant",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, assistantMessage])
      setIsTyping(false)
    }, 1500)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const hasMessages = messages.length > 0

  return (
    <div className="flex flex-col min-h-screen p-4">
      <div className="w-full max-w-4xl mx-auto flex-1 flex flex-col">
        {/* Messages Area */}
        <AnimatePresence>
          {hasMessages && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="flex-1 overflow-y-auto mb-4 space-y-4 max-h-[60vh]"
            >
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {message.role === "assistant" && (
                    <div className="flex items-start gap-3">
                      {/* Mini shader avatar for assistant */}
                      <div className="relative flex items-center justify-center w-8 h-8 flex-shrink-0">
                        <div className="z-10 absolute bg-white/5 h-6 w-6 rounded-full backdrop-blur-[2px]">
                          <div className="h-[1px] w-[1px] bg-white rounded-full absolute top-2 left-2 blur-[0.5px]" />
                          <div className="h-[1px] w-[1px] bg-white rounded-full absolute top-1.5 left-3.5 blur-[0.4px]" />
                          <div className="h-[1px] w-[1px] bg-white rounded-full absolute top-4 left-1 blur-[0.5px]" />
                        </div>
                        <LiquidMetal
                          style={{ height: 32, width: 32, filter: "blur(6px)", position: "absolute" }}
                          colorBack="hsl(0, 0%, 0%, 0)"
                          colorTint="hsl(220, 100%, 45%)"
                          repetition={4}
                          softness={0.5}
                          shiftRed={0.05}
                          shiftBlue={0.6}
                          distortion={0.1}
                          contour={1}
                          shape="circle"
                          offsetX={0}
                          offsetY={0}
                          scale={0.58}
                          rotation={50}
                          speed={5}
                        />
                        <LiquidMetal
                          style={{ height: 32, width: 32 }}
                          colorBack="hsl(0, 0%, 0%, 0)"
                          colorTint="hsl(220, 100%, 45%)"
                          repetition={4}
                          softness={0.5}
                          shiftRed={0.05}
                          shiftBlue={0.6}
                          distortion={0.1}
                          contour={1}
                          shape="circle"
                          offsetX={0}
                          offsetY={0}
                          scale={0.58}
                          rotation={50}
                          speed={5}
                        />
                      </div>
                      <div className="bg-zinc-900/80 border border-blue-500/20 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[80%]">
                        <p className="text-white/90 text-sm">{message.content}</p>
                      </div>
                    </div>
                  )}
                  {message.role === "user" && (
                    <div className="bg-blue-600/20 border border-blue-500/30 rounded-2xl rounded-tr-sm px-4 py-3 max-w-[80%]">
                      <p className="text-white text-sm">{message.content}</p>
                    </div>
                  )}
                </motion.div>
              ))}

              {/* Typing indicator */}
              {isTyping && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start"
                >
                  <div className="flex items-start gap-3">
                    <div className="relative flex items-center justify-center w-8 h-8 flex-shrink-0">
                      <div className="z-10 absolute bg-white/5 h-6 w-6 rounded-full backdrop-blur-[2px]">
                        <div className="h-[1px] w-[1px] bg-white rounded-full absolute top-2 left-2 blur-[0.5px]" />
                        <div className="h-[1px] w-[1px] bg-white rounded-full absolute top-1.5 left-3.5 blur-[0.4px]" />
                        <div className="h-[1px] w-[1px] bg-white rounded-full absolute top-4 left-1 blur-[0.5px]" />
                      </div>
                      <LiquidMetal
                        style={{ height: 32, width: 32, filter: "blur(6px)", position: "absolute" }}
                        colorBack="hsl(0, 0%, 0%, 0)"
                        colorTint="hsl(220, 100%, 45%)"
                        repetition={4}
                        softness={0.5}
                        shiftRed={0.05}
                        shiftBlue={0.6}
                        distortion={0.1}
                        contour={1}
                        shape="circle"
                        offsetX={0}
                        offsetY={0}
                        scale={0.58}
                        rotation={50}
                        speed={5}
                      />
                      <LiquidMetal
                        style={{ height: 32, width: 32 }}
                        colorBack="hsl(0, 0%, 0%, 0)"
                        colorTint="hsl(220, 100%, 45%)"
                        repetition={4}
                        softness={0.5}
                        shiftRed={0.05}
                        shiftBlue={0.6}
                        distortion={0.1}
                        contour={1}
                        shape="circle"
                        offsetX={0}
                        offsetY={0}
                        scale={0.58}
                        rotation={50}
                        speed={5}
                      />
                    </div>
                    <div className="bg-zinc-900/80 border border-blue-500/20 rounded-2xl rounded-tl-sm px-4 py-3">
                      <div className="flex gap-1">
                        <motion.div
                          className="w-2 h-2 bg-blue-500/60 rounded-full"
                          animate={{ opacity: [0.4, 1, 0.4] }}
                          transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                        />
                        <motion.div
                          className="w-2 h-2 bg-blue-500/60 rounded-full"
                          animate={{ opacity: [0.4, 1, 0.4] }}
                          transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                        />
                        <motion.div
                          className="w-2 h-2 bg-blue-500/60 rounded-full"
                          animate={{ opacity: [0.4, 1, 0.4] }}
                          transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Welcome state - only show when no messages */}
        <AnimatePresence>
          {!hasMessages && (
            <motion.div
              className="flex flex-row items-center mb-2"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* Shader Circle */}
              <motion.div
                id="circle-ball"
                className="relative flex items-center justify-center z-10"
                animate={{
                  y: isFocused ? 50 : 0,
                  opacity: isFocused ? 0 : 100,
                  filter: isFocused ? "blur(4px)" : "blur(0px)",
                  rotate: isFocused ? 180 : 0,
                }}
                transition={{
                  duration: 0.5,
                  type: "spring",
                  stiffness: 200,
                  damping: 20,
                }}
              >
                <div className="z-10 absolute bg-white/5 h-11 w-11 rounded-full backdrop-blur-[3px]">
                  <div className="h-[2px] w-[2px] bg-white rounded-full absolute top-4 left-4  blur-[1px]" />
                  <div className="h-[2px] w-[2px] bg-white rounded-full absolute top-3 left-7  blur-[0.8px]" />
                  <div className="h-[2px] w-[2px] bg-white rounded-full absolute top-8 left-2  blur-[1px]" />
                  <div className="h-[2px] w-[2px] bg-white rounded-full absolute top-5 left-9 blur-[0.8px]" />
                  <div className="h-[2px] w-[2px] bg-white rounded-full absolute top-7 left-7  blur-[1px]" />
                </div>
                <LiquidMetal
                  style={{ height: 80, width: 80, filter: "blur(14px)", position: "absolute" }}
                  colorBack="hsl(0, 0%, 0%, 0)"
                  colorTint="hsl(220, 100%, 45%)"
                  repetition={4}
                  softness={0.5}
                  shiftRed={0.05}
                  shiftBlue={0.6}
                  distortion={0.1}
                  contour={1}
                  shape="circle"
                  offsetX={0}
                  offsetY={0}
                  scale={0.58}
                  rotation={50}
                  speed={5}
                />
                <LiquidMetal
                  style={{ height: 80, width: 80 }}
                  colorBack="hsl(0, 0%, 0%, 0)"
                  colorTint="hsl(220, 100%, 45%)"
                  repetition={4}
                  softness={0.5}
                  shiftRed={0.05}
                  shiftBlue={0.6}
                  distortion={0.1}
                  contour={1}
                  shape="circle"
                  offsetX={0}
                  offsetY={0}
                  scale={0.58}
                  rotation={50}
                  speed={5}
                />
              </motion.div>

              {/* Greeting Text */}
              <motion.p
                className="text-white/40 text-sm font-light z-10"
                animate={{
                  y: isFocused ? 50 : 0,
                  opacity: isFocused ? 0 : 100,
                  filter: isFocused ? "blur(4px)" : "blur(0px)",
                }}
                transition={{
                  duration: 0.5,
                  type: "spring",
                  stiffness: 200,
                  damping: 20,
                }}
              >
                Hey there! I'm here to help with anything you need
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="relative">
          <motion.div
            className="absolute w-full h-full z-0 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: isFocused ? 1 : 0 }}
            transition={{
              duration: 0.8,
            }}
          >
            <PulsingBorder
              style={{ height: "146.5%", minWidth: "143%" }}
              colorBack="hsl(0, 0%, 0%)"
              roundness={0.18}
              thickness={0}
              softness={0}
              intensity={0.3}
              bloom={2}
              spots={2}
              spotSize={0.25}
              pulse={0}
              smoke={0.35}
              smokeSize={0.4}
              scale={0.7}
              rotation={0}
              offsetX={0}
              offsetY={0}
              speed={1}
              colors={[
                "hsl(220, 100%, 30%)",
                "hsl(210, 100%, 50%)",
                "hsl(230, 60%, 20%)",
                "hsl(215, 100%, 40%)",
                "hsl(230, 80%, 8%)",
              ]}
            />
          </motion.div>

          <motion.div
            className="relative bg-[#040404] rounded-2xl p-4 z-10"
            animate={{
              borderColor: isFocused ? "#1E50E6" : "#3D3D3D",
            }}
            transition={{
              duration: 0.6,
              delay: 0.1,
            }}
            style={{
              borderWidth: "1px",
              borderStyle: "solid",
            }}
          >
            {/* Message Input */}
            <div className="relative mb-6">
              <Textarea
                placeholder="Ask me anything..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                className="min-h-[80px] resize-none bg-transparent border-none text-white text-base placeholder:text-zinc-500 focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:outline-none [&:focus]:ring-0 [&:focus]:outline-none [&:focus-visible]:ring-0 [&:focus-visible]:outline-none"
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
              />
            </div>

            <div className="flex items-center justify-between">
              {/* Left side icons */}
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-100 hover:text-white p-0"
                >
                  <Brain className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white p-0"
                >
                  <Link className="h-4 w-4" />
                </Button>
                {/* Center model selector */}
                <div className="flex items-center">
                  <Select defaultValue="gpt-4">
                    <SelectTrigger className="bg-zinc-900 border-[#3D3D3D] text-white hover:bg-zinc-700 text-xs rounded-full px-2 h-8 min-w-[150px]">
                      <div className="flex items-center gap-2">
                        <span className="text-xs">⚡</span>
                        <SelectValue />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 z-30 border-[#3D3D3D] rounded-xl z-30">
                      <SelectItem value="gemini-2.5-pro" className="text-white hover:bg-zinc-700 rounded-lg">
                        Gemini 2.5 Pro
                      </SelectItem>
                      <SelectItem value="gpt-4" className="text-white hover:bg-zinc-700 rounded-lg">
                        GPT-4
                      </SelectItem>
                      <SelectItem value="claude-3" className="text-white hover:bg-zinc-700 rounded-lg">
                        Claude 3
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Right side icons */}
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 w-10 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white p-0"
                >
                  <Folder className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 w-10 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white p-0"
                >
                  <Mic className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isTyping}
                  className="h-10 w-10 rounded-full bg-blue-600/25 hover:bg-blue-600/35 text-blue-500 p-0 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
