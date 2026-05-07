import Foundation

if #available(macOS 13.0, *) {
    let args = CommandLine.arguments
    guard args.count >= 3 else {
        FileHandle.standardError.write("Usage: screen-recorder <output.mp4> <timeline.json>\n".data(using: .utf8)!)
        exit(2)
    }
    let outputURL = URL(fileURLWithPath: args[1])
    let timelineURL = URL(fileURLWithPath: args[2])

    let recorder = Recorder(outputURL: outputURL)
    let timeline = TimelineWriter(outputURL: timelineURL)

    _ = Task {
        do {
            try await recorder.start()
            print("recording-started")
            FileHandle.standardOutput.synchronizeFile()
        } catch {
            FileHandle.standardError.write("Failed to start: \(error)\n".data(using: .utf8)!)
            exit(3)
        }
    }

    while let line = readLine() {
        if line.hasPrefix("action ") {
            let parts = line.split(separator: " ", maxSplits: 2).map(String.init)
            let idx = Int(parts[1]) ?? 0
            let file = parts.count > 2 ? parts[2] : nil
            timeline.record(actionIndex: idx, screenshotFilename: file)
        } else if line == "stop" {
            break
        }
    }

    Task {
        await recorder.stop()
        try? timeline.flush()
        exit(0)
    }
    RunLoop.main.run()
} else {
    FileHandle.standardError.write("Requires macOS 13.0+\n".data(using: .utf8)!)
    exit(1)
}
