// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "screen-recorder",
    platforms: [.macOS(.v13)],
    products: [
        .executable(name: "screen-recorder", targets: ["screen-recorder"]),
    ],
    targets: [
        .executableTarget(
            name: "screen-recorder",
            path: "Sources/screen-recorder"
        ),
        .testTarget(
            name: "RecorderTests",
            dependencies: ["screen-recorder"],
            path: "Tests/RecorderTests"
        ),
    ]
)
