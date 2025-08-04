import React, { createContext, useContext, useState } from 'react';

type StringStoreContextType = {
  value: string;
  setString: (newVal: string) => void;
};

const StringStoreContext = createContext<StringStoreContextType | null>(null);

export const StringStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [value, setValue] = useState('');

  return (
    <StringStoreContext.Provider value={{ value, setString: setValue }}>
      {children}
    </StringStoreContext.Provider>
  );
};

export const useStringStore = (): StringStoreContextType => {
  const context = useContext(StringStoreContext);
  if (!context) throw new Error('useStringStore must be used within a StringStoreProvider');
  return context;
};