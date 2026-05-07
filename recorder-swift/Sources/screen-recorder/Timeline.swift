import Foundation

struct TimelineEntry: Codable {
    let frameOffsetMs: Int64
    let actionIndex: Int
    let screenshotFilename: String?
}

final class TimelineWriter {
    private let outputURL: URL
    private var entries: [TimelineEntry] = []
    private let startTime: Date

    init(outputURL: URL) {
        self.outputURL = outputURL
        self.startTime = Date()
    }

    func record(actionIndex: Int, screenshotFilename: String? = nil) {
        let offset = Int64(Date().timeIntervalSince(startTime) * 1000)
        entries.append(TimelineEntry(
            frameOffsetMs: offset,
            actionIndex: actionIndex,
            screenshotFilename: screenshotFilename
        ))
    }

    func flush() throws {
        let data = try JSONEncoder().encode(entries)
        try data.write(to: outputURL)
    }
}
