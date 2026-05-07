// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "screen-recorder",
    platforms: [.macOS(.v13)],
    products: [
        .executable(name: "screen-recorder", targets: ["screen-recorder"]),
        .executable(name: "panic-key", targets: ["panic-key"]),
    ],
    targets: [
        .executableTarget(name: "screen-recorder", path: "Sources/screen-recorder"),
        .executableTarget(name: "panic-key", path: "Sources/panic-key"),
        .testTarget(name: "RecorderTests", dependencies: ["screen-recorder"], path: "Tests/RecorderTests"),
    ]
)
