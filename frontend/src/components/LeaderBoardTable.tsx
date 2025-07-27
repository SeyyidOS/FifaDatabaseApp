import React, { useState } from "react";
import "../styles/Leaderboard.css";

interface LeaderboardTableProps {
  columns: string[];
  data: (string | number)[][];
}

const LeaderboardTable: React.FC<LeaderboardTableProps> = ({
  columns,
  data,
}) => {
  const [sortColumn, setSortColumn] = useState<number | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const handleSort = (colIndex: number) => {
    if (sortColumn === colIndex) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(colIndex);
      setSortOrder("desc");
    }
  };

  const sortedData = React.useMemo(() => {
    if (sortColumn === null) return data;
    return [...data].sort((a, b) => {
      const valA = a[sortColumn];
      const valB = b[sortColumn];

      // Convert to numeric if possible (handles "100%" and other numbers)
      const numA = parseFloat(String(valA).replace("%", ""));
      const numB = parseFloat(String(valB).replace("%", ""));

      if (!isNaN(numA) && !isNaN(numB)) {
        return sortOrder === "asc" ? numA - numB : numB - numA;
      }

      // Fallback for strings
      return sortOrder === "asc"
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  }, [data, sortColumn, sortOrder]);

  return (
    <table className="leaderboard-table">
      <thead>
        <tr>
          {columns.map((col, idx) => (
            <th
              key={idx}
              onClick={() => handleSort(idx)}
              style={{ cursor: "pointer" }}
            >
              {col}
              {sortColumn === idx ? (sortOrder === "asc" ? " ▲" : " ▼") : ""}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sortedData.map((row, idx) => (
          <tr key={idx}>
            {row.map((cell, cIdx) => (
              <td key={cIdx}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default LeaderboardTable;
