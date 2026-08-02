# Kotlin & Android Quickstart

This gets you from an empty Android project to your first exercises on screen,
using Retrofit, OkHttp, and coroutines — the stack most Android apps already run.

If you're on Kotlin Multiplatform, [Ktor](https://ktor.io/docs/client-create-and-configure.html)
is the equivalent and the ideas here map directly. For a plain-JVM (non-Android)
client with the full sync loop, see the complete
[`ExerciseDb.kt`](https://github.com/PerspicaciousGuy/exercisedb-api/tree/main/examples/kotlin)
example.

::: warning Don't ship your API key in the app
An API key baked into a distributed APK can be extracted — anyone can pull it
from the binary. For production, **proxy the API through your own backend** and
keep the key server-side, or issue short-lived per-user tokens from a backend you
control. The direct-from-app setup below is right for a prototype, an internal
build, or learning the API. See the [security note](#production-key-handling) at
the end.
:::

## 1. Get an API key

Register and copy your key — see [Getting Started](/getting-started) for the full
flow. In short:

```bash
curl -X POST https://api.harshitbishnoi.dev/auth/register \
  -H 'content-type: application/json' \
  -d '{ "email": "you@example.com", "password": "a-long-passphrase", "name": "You" }'
```

The key comes back once, as `apiKey.key`. Store it — for now, in
`local.properties` (which is git-ignored), not in source.

## 2. Add dependencies

In your module's `build.gradle.kts`:

```kotlin
plugins {
    kotlin("plugin.serialization") version "2.0.0"
}

dependencies {
    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
    implementation("com.jakewharton.retrofit:retrofit2-kotlinx-serialization-converter:1.0.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
}
```

Add the internet permission to `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
```

## 3. Model the response

Every success response is a `{ success, data }` envelope; list endpoints add
`pagination`. Model the envelope once and reuse it.

```kotlin
import kotlinx.serialization.Serializable

@Serializable
data class Envelope<T>(val data: T, val pagination: Pagination? = null)

@Serializable
data class Pagination(val limit: Int, val offset: Int)

@Serializable
data class ExerciseSummary(
    val id: String,
    val slug: String,
    val name: String,
    val status: String,
    val category: String? = null,
    val difficulty: String,
    val movementPattern: String,
    val tags: List<String> = emptyList(),
    val updatedAt: String
)
```

::: tip Ignore unknown keys
The catalog grows fields over time. Configure the JSON parser with
`ignoreUnknownKeys = true` (step 5) so a new field never crashes an older app
build.
:::

## 4. Declare the API

Retrofit turns an interface into an HTTP client. Add the key with an interceptor
so you never repeat the header.

```kotlin
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Query

interface ExerciseDbApi {
    @GET("exercises")
    suspend fun listExercises(
        @Query("muscle") muscle: String? = null,
        @Query("limit") limit: Int = 20
    ): Envelope<List<ExerciseSummary>>

    @GET("exercises/{id}/substitutes")
    suspend fun substitutes(
        @Path("id") id: String,
        @Query("equipment") equipment: String? = null
    ): Envelope<List<ExerciseSummary>>
}
```

## 5. Build the client

```kotlin
import kotlinx.serialization.json.Json
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import okhttp3.MediaType.Companion.toMediaType

private const val BASE_URL = "https://api.harshitbishnoi.dev/"

fun createApi(apiKey: String): ExerciseDbApi {
    val json = Json { ignoreUnknownKeys = true }

    val client = OkHttpClient.Builder()
        .addInterceptor(Interceptor { chain ->
            val request = chain.request().newBuilder()
                .header("x-api-key", apiKey)
                .build()
            chain.proceed(request)
        })
        .build()

    return Retrofit.Builder()
        .baseUrl(BASE_URL)
        .client(client)
        .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
        .build()
        .create(ExerciseDbApi::class.java)
}
```

## 6. Make the call

From a `ViewModel`, in a coroutine:

```kotlin
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.launch

class CatalogViewModel(apiKey: String) : ViewModel() {
    private val api = createApi(apiKey)

    fun loadChestExercises() {
        viewModelScope.launch {
            try {
                val page = api.listExercises(muscle = "chest", limit = 10)
                page.data.forEach { println("${it.slug} — ${it.name}") }
            } catch (e: ExerciseDbException) {
                // handle a structured API error — see step 7
            }
        }
    }
}
```

`page.data` is your list of summaries; `page.pagination` carries `limit` and
`offset`. Fetch the full record (instructions, cues, programming) with a
`GET exercises/{id}` call when the user opens an exercise.

## 7. Handle errors

Every error is [RFC 9457 problem+json](/getting-started#errors). Branch on the
`code` member — it's stable; `detail` is prose that may be reworded.

```kotlin
import kotlinx.serialization.Serializable
import retrofit2.HttpException

@Serializable
data class Problem(
    val status: Int,
    val code: String,
    val detail: String,
    val requestId: String? = null
)

class ExerciseDbException(val problem: Problem) : RuntimeException(problem.detail)

// Wrap a call to surface a typed error:
suspend fun <T> ExerciseDbApi.guarded(json: Json, call: suspend () -> T): T =
    try {
        call()
    } catch (e: HttpException) {
        val body = e.response()?.errorBody()?.string().orEmpty()
        throw ExerciseDbException(json.decodeFromString<Problem>(body))
    }
```

```kotlin
if (error.problem.code == "RATE_LIMIT_EXCEEDED") {
    // free tier is 1,000 requests/day; back off until reset
}
```

Keep `problem.requestId` in your logs — on a `5xx` it's the only handle support
can use to find the matching server log line.

## 8. Use the graph

The same client reaches the V2 [graph endpoints](/concepts/relationship-graph).
Finding [substitutes](/guides/finding-substitutes) for a user's equipment:

```kotlin
val subs = api.substitutes(benchPressId, equipment = "dumbbell,bench")
subs.data.forEach { println(it.name) }
```

Add `@GET` methods for `exercises/{id}/path`, `exercises/{id}/progressions`, and
so on the same way — they all return the summary envelope.

## Don't call the API on every screen

For a real app, sync the catalog into a local database (Room) once and refresh
only what changed — don't hit the network each time a screen opens. The
[Sync Guide](/sync-guide) explains the loop, and the full
[`ExerciseDb.kt`](https://github.com/PerspicaciousGuy/exercisedb-api/tree/main/examples/kotlin)
example implements it end to end, including the two failure modes that silently
corrupt a local copy.

## Production key handling

As flagged at the top: a key shipped in an APK is extractable. For anything
public:

- **Proxy through your backend.** Your app calls your server; your server holds
  the ExerciseDB key and forwards the request. The key never leaves your
  infrastructure.
- **Cache aggressively.** The catalog is public and changes rarely, so most reads
  can be served from your own cache or a synced local copy — cutting both your
  exposure and your request count.

For a prototype or internal build, the key in `local.properties` is fine. Just
don't ship it to a store build.
