import Foundation
import Vision
import ImageIO

struct Input: Decodable { let path: String; let file: String }
struct Line: Encodable { let text: String; let confidence: Float; let x: Double; let y: Double; let width: Double; let height: Double }
struct Result: Encodable { let path: String; let lines: [Line]; let error: String? }

guard CommandLine.arguments.count == 2 else {
    fputs("Usage: swift audit-watermarks.swift <inputs.json>\n", stderr)
    exit(1)
}
let inputs = try JSONDecoder().decode([Input].self, from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))
let encoder = JSONEncoder()
encoder.outputFormatting = [.sortedKeys]
for input in inputs {
    let result: Result = autoreleasepool {
        do {
            let handler = VNImageRequestHandler(url: URL(fileURLWithPath: input.file), options: [:])
            var output: [Line] = []
            for region in [CGRect(x: 0, y: 0, width: 1, height: 0.3), CGRect(x: 0, y: 0.82, width: 1, height: 0.18)] {
                let request = VNRecognizeTextRequest()
                request.recognitionLevel = .accurate
                request.recognitionLanguages = ["en-US"]
                request.usesLanguageCorrection = false
                request.minimumTextHeight = 0.003
                request.regionOfInterest = region
                try handler.perform([request])
                for observation in request.results ?? [] {
                    guard let candidate = observation.topCandidates(1).first else { continue }
                    let box = observation.boundingBox
                    output.append(Line(text: candidate.string, confidence: candidate.confidence,
                        x: box.minX, y: box.minY, width: box.width, height: box.height))
                }
            }
            return Result(path: input.path, lines: output, error: nil)
        } catch {
            return Result(path: input.path, lines: [], error: error.localizedDescription)
        }
    }
    print(String(data: try encoder.encode(result), encoding: .utf8)!)
    fflush(stdout)
}
