// ExerciseDB API client — Kotlin (JVM 11+), java.net.http + kotlinx.serialization.
//
// build.gradle.kts:
//   plugins { kotlin("plugin.serialization") version "2.0.0" }
//   dependencies {
//     implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
//   }

package dev.exercisedb.example

import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

private const val BASE_URL = "http://localhost:3000"
private const val PAGE_SIZE = 100

/** Errors are RFC 9457 problem+json. `code` is stable; `detail` is prose. */
@Serializable
data class Problem(val status: Int, val code: String, val detail: String)

class ApiException(val problem: Problem) : RuntimeException(problem.detail)

@Serializable
data class Exercise(
    val id: String,
    val slug: String,
    val name: String,
    var status: String
)

@Serializable
data class Tombstone(val exerciseId: String, val changeType: String)

@Serializable
data class Pagination(val nextCursor: String? = null, val hasMore: Boolean)

@Serializable
data class SyncPage(
    val exercises: List<Exercise>,
    val tombstones: List<Tombstone>,
    /** Null only when the catalog has never recorded a change. */
    val latestChangeAt: String? = null
)

@Serializable
data class Envelope<T>(val data: T, val pagination: Pagination? = null)

class ExerciseDbClient(private val apiKey: String) {
    private val http: HttpClient = HttpClient.newHttpClient()
    private val json = Json { ignoreUnknownKeys = true }

    private fun fetch(path: String): String {
        val request = HttpRequest.newBuilder()
            .uri(URI.create("$BASE_URL$path"))
            .header("x-api-key", apiKey)
            .GET()
            .build()

        val response = http.send(request, HttpResponse.BodyHandlers.ofString())

        if (response.statusCode() >= 400) {
            throw ApiException(json.decodeFromString<Problem>(response.body()))
        }

        return response.body()
    }

    fun listExercises(limit: Int = 5): List<Exercise> =
        json.decodeFromString<Envelope<List<Exercise>>>(
            fetch("/exercises?limit=$limit")
        ).data

    /**
     * Walks every page of a sync and applies it to [store].
     *
     * `limit` bounds change events, not exercises: an exercise created and then
     * updated inside the window is one record from two events, and deleted
     * records are dropped entirely. So follow the cursor, never `size`.
     */
    fun sync(store: LocalStore) {
        val since = store.watermark
        var cursor: String? = null
        var watermark = since
        val pages = mutableListOf<SyncPage>()

        do {
            val query = buildString {
                append("limit=$PAGE_SIZE")
                since?.let { append("&updated_since=$it") }
                cursor?.let { append("&cursor=$it") }
            }

            val page = json.decodeFromString<Envelope<SyncPage>>(
                fetch("/sync/exercises?$query")
            )
            pages.add(page.data)

            // Identical on every page of one sync: the server reads it before
            // the first page, so a record written mid-sync arrives on the next
            // run instead of being skipped.
            watermark = page.data.latestChangeAt ?: watermark
            cursor = page.pagination?.nextCursor
        } while (cursor != null)

        // Records and watermark must commit together. A watermark that lands
        // without its records means the next sync starts after data you never
        // wrote.
        store.transaction {
            for (page in pages) {
                page.exercises.forEach(store::upsert)

                for (tombstone in page.tombstones) {
                    if (tombstone.changeType == "deleted") {
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

/** Stand-in for your real database. */
class LocalStore {
    val exercises = mutableMapOf<String, Exercise>()
    var watermark: String? = null

    fun upsert(exercise: Exercise) {
        exercises[exercise.id] = exercise
    }

    fun remove(id: String) {
        exercises.remove(id)
    }

    fun markDeprecated(id: String) {
        exercises[id]?.status = "deprecated"
    }

    fun transaction(work: () -> Unit) = work()
}

fun main() {
    val apiKey = System.getenv("EXERCISEDB_API_KEY")

    if (apiKey.isNullOrEmpty()) {
        System.err.println("Set EXERCISEDB_API_KEY")
        return
    }

    val client = ExerciseDbClient(apiKey)

    try {
        client.listExercises(limit = 3).forEach { println("${it.slug} — ${it.name}") }
    } catch (error: ApiException) {
        if (error.problem.code == "RATE_LIMIT_EXCEEDED") {
            System.err.println("Daily quota exhausted. Retry after midnight UTC.")
            return
        }
        throw error
    }

    client.sync(LocalStore())
}
