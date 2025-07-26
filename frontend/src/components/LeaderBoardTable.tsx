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

      if (typeof valA === "number" && typeof valB === "number") {
        return sortOrder === "asc" ? valA - valB : valB - valA;
      }

      // For strings, sort alphabetically
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
