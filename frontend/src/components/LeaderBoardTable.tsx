import React from "react";
import "../styles/Leaderboard.css";

interface LeaderboardTableProps {
  columns: string[];
  data: (string | number)[][];
}

const LeaderboardTable: React.FC<LeaderboardTableProps> = ({
  columns,
  data,
}) => {
  return (
    <table className="leaderboard-table">
      <thead>
        <tr>
          {columns.map((col, idx) => (
            <th key={idx}>{col}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.length === 0 ? (
          <tr>
            <td colSpan={columns.length}>No data available</td>
          </tr>
        ) : (
          data.map((row, idx) => (
            <tr key={idx}>
              {row.map((cell, i) => (
                <td key={i}>{cell}</td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
};

export default LeaderboardTable;
