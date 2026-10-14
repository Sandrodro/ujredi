import 'package:flutter/material.dart';

import 'shared/crossword_grid.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Ujredi',
      theme: ThemeData(
        fontFamily: 'NotoSerifGeorgian',
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple),
      ),
      home: const GridPreviewPage(),
    );
  }
}

// Hardcoded sample until the puzzle JSON schema exists.
const _sampleRows = <String>[
  '....#.....#...',
  '....#.....#...',
  '..........#...',
  '...#....#.....',
  '###...#....###',
  '##....#.......',
  '....##....#...',
  '...#....##....',
  '.......#....##',
  '###....#...###',
  '.....#....#...',
  '...#..........',
  '...#.....#....',
  '...#.....#....',
];

class GridPreviewPage extends StatefulWidget {
  const GridPreviewPage({super.key});

  @override
  State<GridPreviewPage> createState() => _GridPreviewPageState();
}

class _GridPreviewPageState extends State<GridPreviewPage> {
  (int, int)? _selected;
  Axis _direction = Axis.horizontal;

  void _onCellTap(int row, int col) {
    setState(() {
      if (_selected == (row, col)) {
        _direction = _direction == Axis.horizontal
            ? Axis.vertical
            : Axis.horizontal;
      }
      _selected = (row, col);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('უჯრედი')),
      body: Align(
        alignment: Alignment.topCenter,
        child: CrosswordGrid(
          rows: _sampleRows,
          selected: _selected,
          direction: _direction,
          onCellTap: _onCellTap,
        ),
      ),
    );
  }
}
