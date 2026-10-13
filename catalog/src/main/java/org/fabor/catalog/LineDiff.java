package org.fabor.catalog;

/** Minimal unified-style line diff (longest common subsequence). Lines: " " same, "-" removed, "+" added. */
final class LineDiff {
    private LineDiff() { }

    static String diff(String before, String after) {
        String[] a = before.split("\n", -1);
        String[] b = after.split("\n", -1);
        int[][] lcs = new int[a.length + 1][b.length + 1];
        for (int i = a.length - 1; i >= 0; i--) {
            for (int j = b.length - 1; j >= 0; j--) {
                lcs[i][j] = a[i].equals(b[j]) ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
            }
        }
        StringBuilder out = new StringBuilder();
        int i = 0;
        int j = 0;
        while (i < a.length && j < b.length) {
            if (a[i].equals(b[j])) {
                out.append("  ").append(a[i]).append('\n');
                i++;
                j++;
            } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
                out.append("- ").append(a[i++]).append('\n');
            } else {
                out.append("+ ").append(b[j++]).append('\n');
            }
        }
        while (i < a.length) {
            out.append("- ").append(a[i++]).append('\n');
        }
        while (j < b.length) {
            out.append("+ ").append(b[j++]).append('\n');
        }
        return out.toString();
    }
}
