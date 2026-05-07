import AppKit
import Carbon.HIToolbox

// Listens for triple-Esc within 800ms window, prints "PANIC" on stdout, exits.

final class PanicListener {
    private var lastPress: TimeInterval = 0
    private var consecutive: Int = 0
    private let windowMs: Double = 800

    func handle(event: CGEvent) -> CGEvent? {
        let keycode = Int(event.getIntegerValueField(.keyboardEventKeycode))
        if keycode == kVK_Escape {
            let now = Date().timeIntervalSince1970 * 1000
            if now - lastPress < windowMs {
                consecutive += 1
            } else {
                consecutive = 1
            }
            lastPress = now
            if consecutive >= 3 {
                print("PANIC")
                FileHandle.standardOutput.synchronizeFile()
                exit(0)
            }
        }
        return event
    }
}

let listener = PanicListener()

let mask = (1 << CGEventType.keyDown.rawValue)
guard let tap = CGEvent.tapCreate(
    tap: .cgSessionEventTap,
    place: .headInsertEventTap,
    options: .listenOnly,
    eventsOfInterest: CGEventMask(mask),
    callback: { _, _, event, _ in
        _ = listener.handle(event: event)
        return Unmanaged.passUnretained(event)
    },
    userInfo: nil
) else {
    FileHandle.standardError.write("Failed to create event tap. Need Input Monitoring permission.\n".data(using: .utf8)!)
    exit(1)
}

let source = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, tap, 0)
CFRunLoopAddSource(CFRunLoopGetMain(), source, .commonModes)
CGEvent.tapEnable(tap: tap, enable: true)
RunLoop.main.run()
