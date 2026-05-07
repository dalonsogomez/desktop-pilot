// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "screen-recorder",
    platforms: [.macOS(.v13)],
    products: [
        .executable(name: "screen-recorder", targets: ["screen-recorder"]),
        .executable(name: "panic-key", targets: ["panic-key"]),
        .executable(name: "gui-actor", targets: ["gui-actor"]),
    ],
    targets: [
        .executableTarget(name: "screen-recorder", path: "Sources/screen-recorder"),
        .executableTarget(name: "panic-key", path: "Sources/panic-key"),
        .executableTarget(
            name: "gui-actor",
            path: "Sources/gui-actor",
            linkerSettings: [
                .linkedFramework("AppKit"),
                .linkedFramework("Carbon"),
            ]
        ),
        .testTarget(name: "RecorderTests", dependencies: ["screen-recorder"], path: "Tests/RecorderTests"),
    ]
)
