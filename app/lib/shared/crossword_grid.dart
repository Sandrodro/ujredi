import 'package:flutter/material.dart';

import 'crossword_cell.dart';

const supportedCrosswordSizes = {13};
const _outerBorderWidth = 2.5;

/// A square crossword grid. The size is the number of [rows], one of
/// [supportedCrosswordSizes]. Each row is a string of that many characters:
/// `#` is a blocked cell, `.` is an empty cell, any other character is a
/// letter.
///
/// The word of the [selected] cell, along [direction], is colored.
class CrosswordGrid extends StatelessWidget {
  CrosswordGrid({
    super.key,
    required this.rows,
    required this.onCellTap,
    this.selected,
    this.direction = Axis.horizontal,
  }) : assert(
         supportedCrosswordSizes.contains(rows.length) &&
             rows.every((row) => row.length == rows.length),
         'The grid must be square, with a size in $supportedCrosswordSizes',
       );

  final List<String> rows;
  final (int, int)? selected;
  final Axis direction;
  final void Function(int row, int col) onCellTap;

  int get _size => rows.length;

  bool _isWhite(int row, int col) =>
      row >= 0 &&
      col >= 0 &&
      row < _size &&
      col < _size &&
      rows[row][col] != '#';

  /// A white cell has a number if it starts an across or a down word.
  bool _startsWord(int row, int col) {
    final startsAcross = !_isWhite(row, col - 1) && _isWhite(row, col + 1);
    final startsDown = !_isWhite(row - 1, col) && _isWhite(row + 1, col);
    return startsAcross || startsDown;
  }

  /// The cells of the word that contains the selected cell.
  Set<(int, int)> _selectedWord() {
    final start = selected;
    if (start == null) return const {};

    final (dRow, dCol) = direction == Axis.horizontal ? (0, 1) : (1, 0);
    final word = <(int, int)>{};
    for (final step in [-1, 1]) {
      var (row, col) = start;
      while (_isWhite(row, col)) {
        word.add((row, col));
        row += dRow * step;
        col += dCol * step;
      }
    }
    return word;
  }

  @override
  Widget build(BuildContext context) {
    var nextNumber = 1;
    final word = _selectedWord();

    return AspectRatio(
      aspectRatio: 1,
      child: Container(
        decoration: BoxDecoration(
          border: Border.all(color: Colors.black, width: _outerBorderWidth),
        ),
        child: Column(
          children: [
            for (var row = 0; row < _size; row++)
              Expanded(
                child: Row(
                  children: [
                    for (var col = 0; col < _size; col++)
                      Expanded(
                        child: _buildCell(
                          row,
                          col,
                          number: _isWhite(row, col) && _startsWord(row, col)
                              ? nextNumber++
                              : null,
                          highlighted: word.contains((row, col)),
                        ),
                      ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildCell(int row, int col, {int? number, required bool highlighted}) {
    final char = rows[row][col];
    return CrosswordCell(
      key: Key('cell-$row-$col'),
      blocked: char == '#',
      number: number,
      letter: char == '#' || char == '.' ? null : char,
      selected: selected == (row, col),
      highlighted: highlighted,
      onTap: () => onCellTap(row, col),
    );
  }
}
