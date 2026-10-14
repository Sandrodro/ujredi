import 'package:flutter/material.dart';

const crosswordSelectedColor = Color(0xFFFFDA00);
const crosswordWordColor = Color(0xFFA7D8FF);
const crosswordLineColor = Color(0xFF9E9E9E);

class CrosswordCell extends StatelessWidget {
  const CrosswordCell({
    super.key,
    this.blocked = false,
    this.number,
    this.letter,
    this.selected = false,
    this.highlighted = false,
    this.onTap,
  });

  final bool blocked;
  final int? number;
  final String? letter;
  final bool selected;
  final bool highlighted;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final border = Border.all(color: crosswordLineColor, width: 0.5);

    if (blocked) {
      return SizedBox.expand(
        child: DecoratedBox(
          decoration: BoxDecoration(color: Colors.black, border: border),
        ),
      );
    }

    final color = selected
        ? crosswordSelectedColor
        : highlighted
        ? crosswordWordColor
        : Colors.white;

    return GestureDetector(
      onTap: onTap,
      child: DecoratedBox(
        decoration: BoxDecoration(color: color, border: border),
        child: LayoutBuilder(
          builder: (context, constraints) {
            final side = constraints.biggest.shortestSide;
            return Stack(
              children: [
                if (number != null)
                  Positioned(
                    top: side * 0.04,
                    left: side * 0.08,
                    child: Text(
                      '$number',
                      style: TextStyle(
                        color: Colors.black,
                        fontSize: side * 0.28,
                        height: 1,
                      ),
                    ),
                  ),
                if (letter != null)
                  Center(
                    child: Text(
                      letter!,
                      style: TextStyle(color: Colors.black, fontSize: side * 0.6),
                    ),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}
