import XCTest
@testable import screen_recorder

final class RecorderTests: XCTestCase {
    func testTimelineWriterRecordsAndFlushes() throws {
        let tmpURL = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("timeline-test.json")
        let writer = TimelineWriter(outputURL: tmpURL)
        writer.record(actionIndex: 0, screenshotFilename: "000-click.png")
        writer.record(actionIndex: 1, screenshotFilename: "001-type.png")
        try writer.flush()
        let data = try Data(contentsOf: tmpURL)
        let entries = try JSONDecoder().decode([TimelineEntry].self, from: data)
        XCTAssertEqual(entries.count, 2)
        XCTAssertEqual(entries[0].screenshotFilename, "000-click.png")
        try? FileManager.default.removeItem(at: tmpURL)
    }
}
