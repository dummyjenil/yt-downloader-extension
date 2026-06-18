export const YOUTUBE_OVERLAY_STYLES = `
        .ytd-overlay-root {
          font-family: 'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          color: #f4f4f5;
        }

        /* FAB Button styling */
        .ytd-fab-container {
          position: fixed;
          bottom: 24px;
          right: 24px;
          width: 68px;
          height: 68px;
          z-index: 999999;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .ytd-fab {
          position: absolute;
          width: 54px;
          height: 54px;
          border-radius: 50%;
          background: linear-gradient(135deg, #f43f5e 0%, #ff0000 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          cursor: pointer;
          box-shadow: 0 4px 16px rgba(225, 29, 72, 0.4);
          color: white;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          padding: 0;
        }

        .ytd-fab:hover {
          transform: scale(1.08);
          box-shadow: 0 6px 20px rgba(225, 29, 72, 0.55);
        }

        .ytd-fab:active {
          transform: scale(0.95);
        }

        .ytd-fab svg {
          width: 22px;
          height: 22px;
          fill: none;
          stroke: currentColor;
          stroke-width: 2.5;
          stroke-linecap: round;
          stroke-linejoin: round;
          transition: transform 0.2s ease;
        }

        .ytd-fab:hover svg {
          transform: translateY(1px);
        }

        .ytd-progress-ring {
          position: absolute;
          top: 0;
          left: 0;
          width: 68px;
          height: 68px;
          transform: rotate(-90deg);
          pointer-events: none;
        }

        .ytd-progress-ring-circle-bg {
          fill: transparent;
          stroke: rgba(255, 255, 255, 0.1);
          stroke-width: 3.5px;
        }

        .ytd-progress-ring-circle-fg {
          fill: transparent;
          stroke: #8b5cf6;
          stroke-width: 3.5px;
          stroke-linecap: round;
          transition: stroke-dashoffset 0.15s linear;
        }

        /* Dialog Backdrop */
        .ytd-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(0, 0, 0, 0.65);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 99999999;
          animation: fadeIn 0.2s ease-out;
        }

        /* Dialog Card Box */
        .ytd-dialog {
          width: 90%;
          max-width: 420px;
          background: rgba(18, 18, 22, 0.94);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 24px;
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.65);
          padding: 24px;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
          animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          overflow: hidden;
        }

        .ytd-dialog-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 20px;
        }

        .ytd-dialog-title-area {
          flex: 1;
          padding-right: 12px;
        }

        .ytd-dialog-title {
          font-size: 15px;
          font-weight: 700;
          margin: 0 0 6px 0;
          line-height: 1.45;
          color: #f4f4f5;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .ytd-dialog-subtitle {
          font-size: 11px;
          color: #a1a1aa;
          margin: 0;
          font-weight: 500;
        }

        .ytd-close-btn {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          color: #a1a1aa;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
          padding: 0;
        }

        .ytd-close-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #f4f4f5;
          transform: rotate(90deg);
        }

        /* Detail card styling */
        .ytd-detail-card {
          display: flex;
          gap: 12px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 16px;
          padding: 12px;
          margin-bottom: 20px;
        }

        .ytd-thumb {
          width: 90px;
          height: 50px;
          object-fit: cover;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.06);
        }

        .ytd-detail-meta {
          display: flex;
          flex-direction: column;
          justify-content: center;
          flex: 1;
        }

        .ytd-meta-title {
          font-size: 12px;
          font-weight: 600;
          color: #e4e4e7;
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
          overflow: hidden;
          margin-bottom: 2px;
        }

        .ytd-meta-channel {
          font-size: 10px;
          color: #a1a1aa;
          margin-bottom: 4px;
        }

        .ytd-duration-badge {
          background: rgba(139, 92, 246, 0.1);
          color: #c084fc;
          padding: 2px 6px;
          border-radius: 6px;
          font-size: 9px;
          font-weight: 600;
          border: 1px solid rgba(139, 92, 246, 0.15);
          width: fit-content;
        }

        /* Tabs capsule navigation */
        .ytd-tabs {
          display: flex;
          gap: 4px;
          background: rgba(255, 255, 255, 0.02);
          padding: 4px;
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.05);
          margin-bottom: 16px;
        }

        .ytd-tab-btn {
          flex: 1;
          background: transparent;
          border: none;
          border-radius: 10px;
          color: #a1a1aa;
          padding: 8px 0;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          text-align: center;
          transition: all 0.2s ease;
        }

        .ytd-tab-btn:hover {
          color: #f4f4f5;
        }

        .ytd-tab-btn.active {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.04);
          color: #a78bfa;
        }

        /* Lists */
        .ytd-stream-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 220px;
          overflow-y: auto;
          padding-right: 4px;
          margin-bottom: 12px;
        }

        .ytd-stream-list::-webkit-scrollbar {
          width: 4px;
        }

        .ytd-stream-list::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.08);
          border-radius: 4px;
        }

        .ytd-stream-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.015);
          border: 1px solid rgba(255, 255, 255, 0.05);
          transition: all 0.2s ease;
        }

        .ytd-stream-row:hover {
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(255, 255, 255, 0.09);
        }

        .ytd-stream-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex: 1;
        }

        .ytd-stream-label {
          font-size: 12px;
          font-weight: 600;
          color: #f4f4f5;
        }

        .ytd-stream-meta {
          font-size: 10px;
          color: #a1a1aa;
        }

        .ytd-download-icon-btn {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
          color: #f4f4f5;
          border-radius: 10px;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
          padding: 0;
        }

        .ytd-download-icon-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.15);
          color: #a78bfa;
        }

        .ytd-download-icon-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Loading / Error States */
        .ytd-loader-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 30px 0;
          color: #a1a1aa;
          font-size: 12px;
        }

        .ytd-spinner {
          width: 24px;
          height: 24px;
          border: 2.5px solid rgba(255, 255, 255, 0.05);
          border-top: 2.5px solid #a78bfa;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin-bottom: 12px;
        }

        /* Playlist specific styles */
        .ytd-playlist-toolbar {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }

        .ytd-playlist-search {
          flex: 1;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 8px 12px;
          color: white;
          font-size: 12px;
          outline: none;
          transition: all 0.2s;
        }

        .ytd-playlist-search:focus {
          border-color: rgba(167, 139, 250, 0.4);
          background: rgba(255, 255, 255, 0.05);
        }

        .ytd-playlist-sort {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 8px 12px;
          color: #a1a1aa;
          font-size: 12px;
          outline: none;
          cursor: pointer;
        }

        .ytd-playlist-sort option {
          background: #121217;
          color: white;
        }

        .ytd-playlist-selection-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          font-size: 11px;
          color: #a1a1aa;
        }

        .ytd-playlist-btn-group {
          display: flex;
          gap: 6px;
        }

        .ytd-playlist-text-btn {
          background: none;
          border: none;
          color: #a78bfa;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          padding: 2px 4px;
          border-radius: 4px;
          transition: background 0.2s;
        }

        .ytd-playlist-text-btn:hover {
          background: rgba(167, 139, 250, 0.08);
        }

        .ytd-playlist-range-bar {
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          padding: 6px 12px;
          margin-bottom: 16px;
          font-size: 11px;
          color: #a1a1aa;
        }

        .ytd-playlist-range-input {
          width: 45px;
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 6px;
          padding: 3px 6px;
          color: white;
          text-align: center;
          outline: none;
        }

        .ytd-playlist-range-btn {
          background: rgba(167, 139, 250, 0.1);
          border: 1px solid rgba(167, 139, 250, 0.2);
          color: #c084fc;
          padding: 4px 10px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s;
        }

        .ytd-playlist-range-btn:hover {
          background: rgba(167, 139, 250, 0.18);
        }

        .ytd-playlist-video-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 10px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid rgba(255, 255, 255, 0.04);
          transition: all 0.2s;
        }

        .ytd-playlist-video-item:hover {
          background: rgba(255, 255, 255, 0.03);
          border-color: rgba(255, 255, 255, 0.08);
        }

        .ytd-playlist-video-item.selected {
          background: rgba(167, 139, 250, 0.03);
          border-color: rgba(167, 139, 250, 0.15);
        }

        .ytd-playlist-checkbox {
          cursor: pointer;
          width: 16px;
          height: 16px;
          accent-color: #a78bfa;
        }

        .ytd-playlist-video-thumb {
          width: 60px;
          height: 34px;
          object-fit: cover;
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .ytd-playlist-video-details {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }

        .ytd-playlist-video-title {
          font-size: 11.5px;
          font-weight: 600;
          color: #e4e4e7;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ytd-playlist-video-meta {
          font-size: 9.5px;
          color: #a1a1aa;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ytd-playlist-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .ytd-playlist-footer-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .ytd-playlist-selected-count {
          font-size: 12px;
          font-weight: 600;
          color: #e4e4e7;
        }

        .ytd-playlist-concurrency-wrapper {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 10px;
          color: #a1a1aa;
        }

        .ytd-playlist-concurrency-select {
          background: #18181b;
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: white;
          border-radius: 6px;
          padding: 2px 4px;
          outline: none;
          cursor: pointer;
        }

        .ytd-playlist-download-btn {
          background: linear-gradient(135deg, #f43f5e 0%, #8b5cf6 100%);
          border: none;
          color: white;
          padding: 10px 20px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 4px 15px rgba(244, 63, 94, 0.3);
          transition: all 0.2s;
        }

        .ytd-playlist-download-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 18px rgba(244, 63, 94, 0.45);
        }

        .ytd-playlist-download-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .ytd-playlist-download-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          box-shadow: none;
        }

        .ytd-error {
          color: #f43f5e;
          font-size: 12px;
          line-height: 1.5;
          padding: 12px;
          background: rgba(244, 63, 94, 0.06);
          border: 1px solid rgba(244, 63, 94, 0.15);
          border-radius: 12px;
          margin-top: 8px;
          text-align: center;
        }

        .ytd-error-btn {
          margin-top: 10px;
          background: #f43f5e;
          border: none;
          color: white;
          padding: 6px 14px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 11px;
          font-weight: 600;
          transition: background 0.2s;
        }

        .ytd-error-btn:hover {
          background: #e11d48;
        }

        /* Active Download Progress Details inside Dialog */
        .ytd-progress-card {
          margin-top: 12px;
          background: rgba(255, 255, 255, 0.015);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 16px;
          padding: 12px;
        }

        .ytd-progress-card-header {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: #a1a1aa;
          margin-bottom: 6px;
        }

        .ytd-progress-bar-bg {
          width: 100%;
          background: rgba(255, 255, 255, 0.04);
          border-radius: 100px;
          height: 4px;
          overflow: hidden;
          margin-bottom: 8px;
        }

        .ytd-progress-bar-fg {
          height: 100%;
          background: linear-gradient(90deg, #f43f5e 0%, #8b5cf6 100%);
          border-radius: 100px;
          transition: width 0.2s ease;
        }

        .ytd-progress-details {
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          color: #71717a;
        }

        /* Animations declarations */
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
`;
