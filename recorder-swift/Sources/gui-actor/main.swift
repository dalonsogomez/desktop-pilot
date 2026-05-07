import AppKit
import Carbon.HIToolbox
import Foundation

// MARK: - Helpers

func post(_ event: CGEvent?) {
    event?.post(tap: .cghidEventTap)
}

func cgPoint(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
    CGPoint(x: x, y: y)
}

// MARK: - Click

func performClick(button: String, x: CGFloat, y: CGFloat) -> Bool {
    let pt = cgPoint(x, y)

    switch button {
    case "left":
        guard let down = CGEvent(mouseEventSource: nil, mouseType: .leftMouseDown, mouseCursorPosition: pt, mouseButton: .left) else { return false }
        guard let up   = CGEvent(mouseEventSource: nil, mouseType: .leftMouseUp,   mouseCursorPosition: pt, mouseButton: .left)   else { return false }
        post(down); post(up)

    case "right":
        guard let down = CGEvent(mouseEventSource: nil, mouseType: .rightMouseDown, mouseCursorPosition: pt, mouseButton: .right) else { return false }
        guard let up   = CGEvent(mouseEventSource: nil, mouseType: .rightMouseUp,   mouseCursorPosition: pt, mouseButton: .right)  else { return false }
        post(down); post(up)

    case "middle":
        guard let down = CGEvent(mouseEventSource: nil, mouseType: .otherMouseDown, mouseCursorPosition: pt, mouseButton: .center) else { return false }
        guard let up   = CGEvent(mouseEventSource: nil, mouseType: .otherMouseUp,   mouseCursorPosition: pt, mouseButton: .center)  else { return false }
        post(down); post(up)

    case "double":
        for state in [1, 2] {
            guard let down = CGEvent(mouseEventSource: nil, mouseType: .leftMouseDown, mouseCursorPosition: pt, mouseButton: .left) else { return false }
            guard let up   = CGEvent(mouseEventSource: nil, mouseType: .leftMouseUp,   mouseCursorPosition: pt, mouseButton: .left)  else { return false }
            down.setIntegerValueField(.mouseEventClickState, value: Int64(state))
            up.setIntegerValueField(.mouseEventClickState,   value: Int64(state))
            post(down); post(up)
        }

    case "triple":
        for state in [1, 2, 3] {
            guard let down = CGEvent(mouseEventSource: nil, mouseType: .leftMouseDown, mouseCursorPosition: pt, mouseButton: .left) else { return false }
            guard let up   = CGEvent(mouseEventSource: nil, mouseType: .leftMouseUp,   mouseCursorPosition: pt, mouseButton: .left)  else { return false }
            down.setIntegerValueField(.mouseEventClickState, value: Int64(state))
            up.setIntegerValueField(.mouseEventClickState,   value: Int64(state))
            post(down); post(up)
        }

    default:
        return false
    }
    return true
}

// MARK: - Move

func performMove(x: CGFloat, y: CGFloat) -> Bool {
    let pt = cgPoint(x, y)
    guard let ev = CGEvent(mouseEventSource: nil, mouseType: .mouseMoved, mouseCursorPosition: pt, mouseButton: .left) else { return false }
    post(ev)
    return true
}

// MARK: - Drag (linear interpolation, ~10 steps)

func performDrag(x1: CGFloat, y1: CGFloat, x2: CGFloat, y2: CGFloat) -> Bool {
    let start = cgPoint(x1, y1)
    let end   = cgPoint(x2, y2)
    let steps = 10

    guard let down = CGEvent(mouseEventSource: nil, mouseType: .leftMouseDown, mouseCursorPosition: start, mouseButton: .left) else { return false }
    post(down)

    for i in 1...steps {
        let t = CGFloat(i) / CGFloat(steps)
        let px = x1 + (x2 - x1) * t
        let py = y1 + (y2 - y1) * t
        guard let drag = CGEvent(mouseEventSource: nil, mouseType: .leftMouseDragged, mouseCursorPosition: cgPoint(px, py), mouseButton: .left) else { return false }
        post(drag)
        usleep(16_000)  // ~16ms per step ≈ 60fps feel
    }

    guard let up = CGEvent(mouseEventSource: nil, mouseType: .leftMouseUp, mouseCursorPosition: end, mouseButton: .left) else { return false }
    post(up)
    return true
}

// MARK: - Type (Unicode)

func performType(text: String) -> Bool {
    var chars = Array(text.utf16)
    let len   = chars.count
    guard len > 0 else { return true }

    // Post a keyDown+keyUp pair with the full unicode string attached.
    guard let down = CGEvent(keyboardEventSource: nil, virtualKey: 0, keyDown: true) else { return false }
    guard let up   = CGEvent(keyboardEventSource: nil, virtualKey: 0, keyDown: false) else { return false }
    down.keyboardSetUnicodeString(stringLength: len, unicodeString: &chars)
    up.keyboardSetUnicodeString(stringLength: len, unicodeString: &chars)
    post(down)
    post(up)
    return true
}

// MARK: - Hotkey

// Map modifier name tokens to CGEventFlags
func modFlag(_ token: String) -> CGEventFlags? {
    switch token.lowercased() {
    case "cmd", "command":  return .maskCommand
    case "ctrl", "control": return .maskControl
    case "alt", "option":   return .maskAlternate
    case "shift":            return .maskShift
    case "fn":               return .maskSecondaryFn
    default:                 return nil
    }
}

// Map key name to virtual keycode using Carbon constants
func virtualKey(_ token: String) -> CGKeyCode? {
    let t = token.lowercased()
    // Letters
    let letterMap: [String: CGKeyCode] = [
        "a": CGKeyCode(kVK_ANSI_A), "b": CGKeyCode(kVK_ANSI_B), "c": CGKeyCode(kVK_ANSI_C),
        "d": CGKeyCode(kVK_ANSI_D), "e": CGKeyCode(kVK_ANSI_E), "f": CGKeyCode(kVK_ANSI_F),
        "g": CGKeyCode(kVK_ANSI_G), "h": CGKeyCode(kVK_ANSI_H), "i": CGKeyCode(kVK_ANSI_I),
        "j": CGKeyCode(kVK_ANSI_J), "k": CGKeyCode(kVK_ANSI_K), "l": CGKeyCode(kVK_ANSI_L),
        "m": CGKeyCode(kVK_ANSI_M), "n": CGKeyCode(kVK_ANSI_N), "o": CGKeyCode(kVK_ANSI_O),
        "p": CGKeyCode(kVK_ANSI_P), "q": CGKeyCode(kVK_ANSI_Q), "r": CGKeyCode(kVK_ANSI_R),
        "s": CGKeyCode(kVK_ANSI_S), "t": CGKeyCode(kVK_ANSI_T), "u": CGKeyCode(kVK_ANSI_U),
        "v": CGKeyCode(kVK_ANSI_V), "w": CGKeyCode(kVK_ANSI_W), "x": CGKeyCode(kVK_ANSI_X),
        "y": CGKeyCode(kVK_ANSI_Y), "z": CGKeyCode(kVK_ANSI_Z),
    ]
    if let k = letterMap[t] { return k }

    // Digits
    let digitMap: [String: CGKeyCode] = [
        "0": CGKeyCode(kVK_ANSI_0), "1": CGKeyCode(kVK_ANSI_1), "2": CGKeyCode(kVK_ANSI_2),
        "3": CGKeyCode(kVK_ANSI_3), "4": CGKeyCode(kVK_ANSI_4), "5": CGKeyCode(kVK_ANSI_5),
        "6": CGKeyCode(kVK_ANSI_6), "7": CGKeyCode(kVK_ANSI_7), "8": CGKeyCode(kVK_ANSI_8),
        "9": CGKeyCode(kVK_ANSI_9),
    ]
    if let k = digitMap[t] { return k }

    // Special keys
    switch t {
    case "return", "enter":  return CGKeyCode(kVK_Return)
    case "tab":              return CGKeyCode(kVK_Tab)
    case "space":            return CGKeyCode(kVK_Space)
    case "delete", "backspace": return CGKeyCode(kVK_Delete)
    case "escape", "esc":    return CGKeyCode(kVK_Escape)
    case "left":             return CGKeyCode(kVK_LeftArrow)
    case "right":            return CGKeyCode(kVK_RightArrow)
    case "up":               return CGKeyCode(kVK_UpArrow)
    case "down":             return CGKeyCode(kVK_DownArrow)
    case "home":             return CGKeyCode(kVK_Home)
    case "end":              return CGKeyCode(kVK_End)
    case "pageup":           return CGKeyCode(kVK_PageUp)
    case "pagedown":         return CGKeyCode(kVK_PageDown)
    case "f1":               return CGKeyCode(kVK_F1)
    case "f2":               return CGKeyCode(kVK_F2)
    case "f3":               return CGKeyCode(kVK_F3)
    case "f4":               return CGKeyCode(kVK_F4)
    case "f5":               return CGKeyCode(kVK_F5)
    case "f6":               return CGKeyCode(kVK_F6)
    case "f7":               return CGKeyCode(kVK_F7)
    case "f8":               return CGKeyCode(kVK_F8)
    case "f9":               return CGKeyCode(kVK_F9)
    case "f10":              return CGKeyCode(kVK_F10)
    case "f11":              return CGKeyCode(kVK_F11)
    case "f12":              return CGKeyCode(kVK_F12)
    default:                 return nil
    }
}

func performHotkey(combo: String) -> Bool {
    // combo examples: "cmd+c", "cmd+shift+s", "ctrl+alt+t"
    let tokens = combo.lowercased().split(separator: "+").map(String.init)
    guard !tokens.isEmpty else { return false }

    let key = tokens.last!
    let modTokens = tokens.dropLast()

    guard let vk = virtualKey(key) else { return false }

    var flags: CGEventFlags = []
    for mod in modTokens {
        if let f = modFlag(mod) {
            flags.insert(f)
        }
    }

    guard let down = CGEvent(keyboardEventSource: nil, virtualKey: vk, keyDown: true) else { return false }
    guard let up   = CGEvent(keyboardEventSource: nil, virtualKey: vk, keyDown: false) else { return false }
    down.flags = flags
    up.flags   = flags
    post(down)
    post(up)
    return true
}

// MARK: - Scroll

func performScroll(x: CGFloat, y: CGFloat, direction: String, amount: Int32) -> Bool {
    // Move cursor to position first
    _ = performMove(x: x, y: y)

    let pt = cgPoint(x, y)
    // axis1 = vertical (positive = up), axis2 = horizontal (positive = right)
    var axis1: Int32 = 0
    var axis2: Int32 = 0

    switch direction.lowercased() {
    case "up":    axis1 =  amount
    case "down":  axis1 = -amount
    case "right": axis2 =  amount
    case "left":  axis2 = -amount
    default: return false
    }

    guard let ev = CGEvent(scrollWheelEvent2Source: nil,
                           units: .line,
                           wheelCount: 2,
                           wheel1: axis1,
                           wheel2: axis2,
                           wheel3: 0) else { return false }
    ev.location = pt
    post(ev)
    return true
}

// MARK: - Screenshot

func performScreenshot(path: String) -> Bool {
    let proc = Process()
    proc.executableURL = URL(fileURLWithPath: "/usr/sbin/screencapture")
    proc.arguments = ["-x", path]
    do {
        try proc.run()
        proc.waitUntilExit()
        return proc.terminationStatus == 0
    } catch {
        return false
    }
}

// MARK: - Cursor position

func cursorPosition() -> (Int, Int) {
    let loc = NSEvent.mouseLocation
    // NSEvent uses bottom-left origin; CGEvent uses top-left. Convert.
    if let screen = NSScreen.main {
        let screenHeight = screen.frame.height
        return (Int(loc.x), Int(screenHeight - loc.y))
    }
    return (Int(loc.x), Int(loc.y))
}

// MARK: - Parsing helpers

/// Parse a String to CGFloat via Double.
func parseCG(_ s: String) -> CGFloat? {
    guard let d = Double(s) else { return nil }
    return CGFloat(d)
}

// MARK: - Main command loop

func reply(_ msg: String) {
    print(msg)
    FileHandle.standardOutput.synchronizeFile()
}

while let line = readLine() {
    let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { continue }

    let parts = trimmed.split(separator: " ", maxSplits: 100, omittingEmptySubsequences: true).map(String.init)
    let cmd   = parts[0].lowercased()

    switch cmd {

    case "click":
        // click <button> <x> <y>
        guard parts.count == 4,
              let x = parseCG(parts[2]),
              let y = parseCG(parts[3]) else {
            reply("ERR usage: click <left|right|middle|double|triple> <x> <y>"); continue
        }
        reply(performClick(button: parts[1], x: x, y: y) ? "OK" : "ERR click failed")

    case "move":
        // move <x> <y>
        guard parts.count == 3,
              let x = parseCG(parts[1]),
              let y = parseCG(parts[2]) else {
            reply("ERR usage: move <x> <y>"); continue
        }
        reply(performMove(x: x, y: y) ? "OK" : "ERR move failed")

    case "drag":
        // drag <x1> <y1> <x2> <y2>
        guard parts.count == 5,
              let x1 = parseCG(parts[1]),
              let y1 = parseCG(parts[2]),
              let x2 = parseCG(parts[3]),
              let y2 = parseCG(parts[4]) else {
            reply("ERR usage: drag <x1> <y1> <x2> <y2>"); continue
        }
        reply(performDrag(x1: x1, y1: y1, x2: x2, y2: y2) ? "OK" : "ERR drag failed")

    case "type":
        // type <rest of line as text>
        // Reconstruct from parts[1...] to preserve spaces
        guard parts.count >= 2 else {
            reply("ERR usage: type <text>"); continue
        }
        let text = parts[1...].joined(separator: " ")
        reply(performType(text: text) ? "OK" : "ERR type failed")

    case "hotkey":
        // hotkey <combo>  e.g. cmd+c
        guard parts.count == 2 else {
            reply("ERR usage: hotkey <combo>"); continue
        }
        reply(performHotkey(combo: parts[1]) ? "OK" : "ERR hotkey failed")

    case "scroll":
        // scroll <x> <y> <direction> <amount>
        guard parts.count == 5,
              let x = parseCG(parts[1]),
              let y = parseCG(parts[2]),
              let amount = Int32(parts[4]) else {
            reply("ERR usage: scroll <x> <y> <up|down|left|right> <amount>"); continue
        }
        reply(performScroll(x: x, y: y, direction: parts[3], amount: amount) ? "OK" : "ERR scroll failed")

    case "cursor":
        let (cx, cy) = cursorPosition()
        reply("OK \(cx) \(cy)")

    case "screenshot":
        // screenshot <path>
        guard parts.count == 2 else {
            reply("ERR usage: screenshot <path>"); continue
        }
        reply(performScreenshot(path: parts[1]) ? "OK \(parts[1])" : "ERR screenshot failed")

    case "quit":
        reply("OK")
        exit(0)

    default:
        reply("ERR unknown command: \(cmd)")
    }
}
