import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:ujredi/main.dart';
import 'package:ujredi/shared/crossword_cell.dart';

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('tap every white cell twice', (tester) async {
    await tester.pumpWidget(const MyApp());
    await tester.pumpAndSettle();

    final whiteCellKeys = tester
        .widgetList<CrosswordCell>(find.byType(CrosswordCell))
        .where((cell) => !cell.blocked)
        .map((cell) => cell.key!)
        .toList();

    await binding.traceAction(() async {
      for (final key in whiteCellKeys) {
        // The first tap selects the cell. The second tap flips the direction.
        for (var i = 0; i < 2; i++) {
          await tester.tap(find.byKey(key));
          await tester.pumpAndSettle();
        }
      }
    }, reportKey: 'grid_taps');
  });
}
