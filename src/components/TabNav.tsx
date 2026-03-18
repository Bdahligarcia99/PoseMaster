import { ReactNode } from "react";

export type TabId = string;

interface Tab {
  id: TabId;
  label: string;
  content: ReactNode;
}

interface TabNavProps {
  tabs: Tab[];
  activeTab: TabId;
  onTabChange: (tabId: TabId) => void;
}

export default function TabNav({ tabs, activeTab, onTabChange }: TabNavProps) {
  const activeContent = tabs.find((t) => t.id === activeTab)?.content;

  return (
    <div className="flex flex-col">
      {/* Tab bar */}
      <div className="flex border-b border-dark-accent bg-dark-surface rounded-t-xl overflow-hidden">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex-1 px-6 py-4 font-medium transition-all duration-200
                ${isActive
                  ? "text-blue-400 bg-dark-bg border-b-2 border-blue-500 -mb-px"
                  : "text-dark-muted hover:text-dark-text hover:bg-dark-accent/50"
                }`}
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
              id={`tab-${tab.id}`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div
        key={activeTab}
        id={`panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
        className="overflow-hidden animate-tab-content"
      >
        {activeContent}
      </div>
    </div>
  );
}
