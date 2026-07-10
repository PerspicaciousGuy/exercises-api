/// ExerciseDB API client — Dart / Flutter (dart:io + dart:convert only).
///
/// Run: dart run examples/dart/exercisedb.dart
library;

import 'dart:convert';
import 'dart:io';

const String baseUrl = 'http://localhost:3000';
const int pageSize = 100;

/// Errors are RFC 9457 problem+json. `code` is stable; `detail` is prose.
class ApiError implements Exception {
  ApiError(this.status, this.code, this.detail);

  final int status;
  final String code;
  final String detail;

  @override
  String toString() => 'ApiError($code): $detail';
}

class ExerciseDbClient {
  ExerciseDbClient(this.apiKey, {HttpClient? httpClient})
      : _http = httpClient ?? HttpClient();

  final String apiKey;
  final HttpClient _http;

  Future<Map<String, dynamic>> _get(String path) async {
    final request = await _http.getUrl(Uri.parse('$baseUrl$path'));
    request.headers.set('x-api-key', apiKey);

    final response = await request.close();
    final body = jsonDecode(await response.transform(utf8.decoder).join())
        as Map<String, dynamic>;

    if (response.statusCode >= 400) {
      throw ApiError(
        body['status'] as int? ?? response.statusCode,
        body['code'] as String? ?? 'UNKNOWN_ERROR',
        body['detail'] as String? ?? 'Request failed',
      );
    }

    return body;
  }

  Future<List<dynamic>> listExercises({int limit = 5}) async {
    final body = await _get('/exercises?limit=$limit');
    return body['data'] as List<dynamic>;
  }

  /// Walks every page of a sync and applies it to [store].
  ///
  /// `limit` bounds change events, not exercises: an exercise created and then
  /// updated inside the window is one record from two events, and deleted
  /// records are dropped entirely. So follow the cursor, never the list length.
  Future<void> sync(LocalStore store) async {
    final String? since = store.watermark;
    String? cursor;
    String? watermark = since;
    final List<Map<String, dynamic>> pages = <Map<String, dynamic>>[];

    do {
      final query = <String, String>{'limit': '$pageSize'};
      if (since != null) query['updated_since'] = since;
      if (cursor != null) query['cursor'] = cursor;

      final page = await _get('/sync/exercises?${_encode(query)}');
      final data = page['data'] as Map<String, dynamic>;
      pages.add(data);

      // Identical on every page of one sync: the server reads it before the
      // first page, so a record written mid-sync arrives on the next run
      // instead of being skipped.
      watermark = data['latestChangeAt'] as String? ?? watermark;
      cursor = (page['pagination'] as Map<String, dynamic>)['nextCursor']
          as String?;
    } while (cursor != null);

    // Records and watermark must commit together. A watermark that lands
    // without its records means the next sync starts after data you never
    // wrote.
    store.transaction(() {
      for (final data in pages) {
        for (final exercise in data['exercises'] as List<dynamic>) {
          store.upsert(exercise as Map<String, dynamic>);
        }

        for (final tombstone in data['tombstones'] as List<dynamic>) {
          final stone = tombstone as Map<String, dynamic>;
          final id = stone['exerciseId'] as String;

          if (stone['changeType'] == 'deleted') {
            store.remove(id);
          } else {
            store.markDeprecated(id);
          }
        }
      }

      store.watermark = watermark;
    });
  }

  static String _encode(Map<String, String> query) =>
      query.entries.map((e) => '${e.key}=${Uri.encodeComponent(e.value)}').join('&');
}

/// Stand-in for your real database.
class LocalStore {
  final Map<String, Map<String, dynamic>> exercises =
      <String, Map<String, dynamic>>{};
  String? watermark;

  void upsert(Map<String, dynamic> exercise) {
    exercises[exercise['id'] as String] = exercise;
  }

  void remove(String id) => exercises.remove(id);

  void markDeprecated(String id) {
    exercises[id]?['status'] = 'deprecated';
  }

  void transaction(void Function() work) => work();
}

Future<void> main() async {
  final apiKey = Platform.environment['EXERCISEDB_API_KEY'];

  if (apiKey == null || apiKey.isEmpty) {
    stderr.writeln('Set EXERCISEDB_API_KEY');
    exitCode = 1;
    return;
  }

  final client = ExerciseDbClient(apiKey);

  try {
    for (final exercise in await client.listExercises(limit: 3)) {
      final row = exercise as Map<String, dynamic>;
      stdout.writeln('${row['slug']} — ${row['name']}');
    }
  } on ApiError catch (error) {
    if (error.code == 'RATE_LIMIT_EXCEEDED') {
      stderr.writeln('Daily quota exhausted. Retry after midnight UTC.');
      exitCode = 1;
      return;
    }
    rethrow;
  }

  await client.sync(LocalStore());
}
