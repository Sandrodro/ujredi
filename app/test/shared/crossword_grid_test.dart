import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ujredi/shared/crossword_cell.dart';
import 'package:ujredi/shared/crossword_grid.dart';

// Row 0 has a blocked cell at column 2. Row 1 has one at column 0.
// Row 1 column 2 holds a letter.
final _rows = <String>[
  '..#...........',
  '#.ა...........',
  ...List.filled(12, '..............'),
];

Finder _cell(int row, int col) => find.byKey(Key('cell-$row-$col'));

Future<void> _pump(
  WidgetTester tester, {
  (int, int)? selected,
  Axis direction = Axis.horizontal,
  void Function(int row, int col)? onCellTap,
}) {
  return tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: Center(
          child: CrosswordGrid(
            rows: _rows,
            selected: selected,
            direction: direction,
            onCellTap: onCellTap ?? (_, _) {},
          ),
        ),
      ),
    ),
  );
}

Color? _colorOf(WidgetTester tester, int row, int col) {
  final box = tester.widget<DecoratedBox>(
    find.descendant(of: _cell(row, col), matching: find.byType(DecoratedBox)).first,
  );
  return (box.decoration as BoxDecoration).color;
}

void main() {
  testWidgets('renders 196 cells', (tester) async {
    await _pump(tester);

    expect(find.byType(CrosswordCell), findsNWidgets(196));
  });

  testWidgets('shows clue numbers on word starts only', (tester) async {
    await _pump(tester);

    expect(find.descendant(of: _cell(0, 0), matching: find.text('1')), findsOneWidget);
    expect(find.descendant(of: _cell(0, 1), matching: find.text('2')), findsOneWidget);
    expect(find.descendant(of: _cell(0, 3), matching: find.text('3')), findsOneWidget);
    expect(find.descendant(of: _cell(1, 1), matching: find.text('14')), findsOneWidget);
    expect(find.descendant(of: _cell(2, 0), matching: find.text('16')), findsOneWidget);
    expect(find.descendant(of: _cell(1, 4), matching: find.byType(Text)), findsNothing);
  });

  testWidgets('shows the letter of a filled cell', (tester) async {
    await _pump(tester);

    expect(find.descendant(of: _cell(1, 2), matching: find.text('ა')), findsOneWidget);
  });

  testWidgets('tapping a white cell reports its row and column', (tester) async {
    final taps = <(int, int)>[];
    await _pump(tester, onCellTap: (row, col) => taps.add((row, col)));

    await tester.tap(_cell(3, 5));

    expect(taps, [(3, 5)]);
  });

  testWidgets('tapping a blocked cell reports nothing', (tester) async {
    final taps = <(int, int)>[];
    await _pump(tester, onCellTap: (row, col) => taps.add((row, col)));

    await tester.tap(_cell(0, 2));

    expect(taps, isEmpty);
  });

  testWidgets('blocked and white cells have the same size', (tester) async {
    await _pump(tester);

    expect(tester.getSize(_cell(0, 2)), tester.getSize(_cell(0, 3)));
    expect(tester.getSize(_cell(0, 2)).height, greaterThan(0));
  });

  testWidgets('draws the thick border around the cells', (tester) async {
    await _pump(tester);

    final grid = tester.getRect(find.byType(CrosswordGrid));
    final cell = tester.getRect(_cell(0, 0));
    expect(cell.left - grid.left, greaterThan(2));
    expect(cell.top - grid.top, greaterThan(2));
  });

  testWidgets('colors the selected cell yellow', (tester) async {
    await _pump(tester, selected: (4, 4));

    expect(_colorOf(tester, 4, 4), crosswordSelectedColor);
  });

  testWidgets('colors the across word of the selected cell blue', (tester) async {
    await _pump(tester, selected: (0, 5));

    expect(_colorOf(tester, 0, 5), crosswordSelectedColor);
    expect(_colorOf(tester, 0, 3), crosswordWordColor);
    expect(_colorOf(tester, 0, 13), crosswordWordColor);
    expect(_colorOf(tester, 0, 1), isNot(crosswordWordColor));
    expect(_colorOf(tester, 1, 5), isNot(crosswordWordColor));
  });

  testWidgets('colors the down word of the selected cell blue', (tester) async {
    await _pump(tester, selected: (5, 0), direction: Axis.vertical);

    expect(_colorOf(tester, 5, 0), crosswordSelectedColor);
    expect(_colorOf(tester, 2, 0), crosswordWordColor);
    expect(_colorOf(tester, 13, 0), crosswordWordColor);
    expect(_colorOf(tester, 0, 0), isNot(crosswordWordColor));
    expect(_colorOf(tester, 5, 1), isNot(crosswordWordColor));
  });

  testWidgets('colors no word when nothing is selected', (tester) async {
    await _pump(tester);

    expect(_colorOf(tester, 0, 5), isNot(crosswordWordColor));
  });
}
