// ExerciseDB API client — Swift 5.7+ (Foundation only, async/await).
//
// On Linux, add: import FoundationNetworking

import Foundation

private let baseURL = "https://api.harshitbishnoi.dev"
private let pageSize = 100

/// Errors are RFC 9457 problem+json. `code` is stable; `detail` is prose.
struct ApiError: Error, Decodable {
    let status: Int
    let code: String
    let detail: String
}

struct Exercise: Decodable {
    let id: String
    let slug: String
    let name: String
    var status: String
}

struct Tombstone: Decodable {
    let exerciseId: String
    let changeType: String
}

struct Pagination: Decodable {
    let nextCursor: String?
    let hasMore: Bool
}

struct SyncPage: Decodable {
    let exercises: [Exercise]
    let tombstones: [Tombstone]
    /// Null only when the catalog has never recorded a change.
    let latestChangeAt: String?
}

private struct Envelope<T: Decodable>: Decodable {
    let data: T
    let pagination: Pagination?
}

struct ExerciseDBClient {
    let apiKey: String
    private let session = URLSession.shared
    private let decoder = JSONDecoder()

    private func get<T: Decodable>(_ path: String) async throws -> Envelope<T> {
        var request = URLRequest(url: URL(string: baseURL + path)!)
        request.setValue(apiKey, forHTTPHeaderField: "x-api-key")

        let (data, response) = try await session.data(for: request)
        let statusCode = (response as? HTTPURLResponse)?.statusCode ?? 0

        guard (200..<300).contains(statusCode) else {
            throw try decoder.decode(ApiError.self, from: data)
        }

        return try decoder.decode(Envelope<T>.self, from: data)
    }

    func listExercises(limit: Int = 5) async throws -> [Exercise] {
        let envelope: Envelope<[Exercise]> = try await get("/exercises?limit=\(limit)")
        return envelope.data
    }

    /// Walks every page of a sync and applies it to `store`.
    ///
    /// `limit` bounds change events, not exercises: an exercise created and then
    /// updated inside the window is one record from two events, and deleted
    /// records are dropped entirely. So follow the cursor, never `count`.
    func sync(into store: LocalStore) async throws {
        let since = store.watermark
        var cursor: String?
        var watermark = since
        var pages: [SyncPage] = []

        repeat {
            var query = "limit=\(pageSize)"
            if let since { query += "&updated_since=\(since)" }
            if let cursor { query += "&cursor=\(cursor)" }

            let envelope: Envelope<SyncPage> = try await get("/sync/exercises?\(query)")
            pages.append(envelope.data)

            // Identical on every page of one sync: the server reads it before
            // the first page, so a record written mid-sync arrives on the next
            // run instead of being skipped.
            watermark = envelope.data.latestChangeAt ?? watermark
            cursor = envelope.pagination?.nextCursor
        } while cursor != nil

        // Records and watermark must commit together. A watermark that lands
        // without its records means the next sync starts after data you never
        // wrote.
        store.transaction {
            for page in pages {
                for exercise in page.exercises {
                    store.upsert(exercise)
                }

                for tombstone in page.tombstones {
                    if tombstone.changeType == "deleted" {
                        store.remove(tombstone.exerciseId)
                    } else {
                        store.markDeprecated(tombstone.exerciseId)
                    }
                }
            }

            store.watermark = watermark
        }
    }
}

/// Stand-in for your real database.
final class LocalStore {
    private(set) var exercises: [String: Exercise] = [:]
    var watermark: String?

    func upsert(_ exercise: Exercise) { exercises[exercise.id] = exercise }
    func remove(_ id: String) { exercises.removeValue(forKey: id) }

    func markDeprecated(_ id: String) {
        exercises[id]?.status = "deprecated"
    }

    func transaction(_ work: () -> Void) { work() }
}

// Usage:
//
//   let client = ExerciseDBClient(apiKey: ProcessInfo.processInfo
//       .environment["EXERCISEDB_API_KEY"] ?? "")
//
//   do {
//       for exercise in try await client.listExercises(limit: 3) {
//           print("\(exercise.slug) — \(exercise.name)")
//       }
//       try await client.sync(into: LocalStore())
//   } catch let error as ApiError where error.code == "RATE_LIMIT_EXCEEDED" {
//       print("Daily quota exhausted. Retry after midnight UTC.")
//   }
