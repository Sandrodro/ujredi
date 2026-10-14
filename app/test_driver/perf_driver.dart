import 'package:flutter_driver/flutter_driver.dart' as driver;
import 'package:integration_test/integration_test_driver.dart';

Future<void> main() {
  return integrationDriver(
    responseDataCallback: (data) async {
      if (data == null) return;

      final timeline = driver.Timeline.fromJson(
        data['grid_taps'] as Map<String, dynamic>,
      );
      final summary = driver.TimelineSummary.summarize(timeline);

      // Writes build/grid_taps.timeline.json and
      // build/grid_taps.timeline_summary.json.
      await summary.writeTimelineToFile(
        'grid_taps',
        pretty: true,
        includeSummary: true,
      );
    },
  );
}
