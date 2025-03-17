import React from 'react';
import { useTranslation } from 'react-i18next';

const LanguageSelector = () => {
  const { i18n } = useTranslation();

  const changeLanguage = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const language = event.target.value;
    i18n.changeLanguage(language);
    localStorage.setItem('language', language);
  };

  return (
    <select 
      className="language-selector"
      onChange={changeLanguage}
      value={i18n.language}
    >
      <option value="en">English</option>
      <option value="zh">中文</option>
      <option value="ko">한국어</option>
      <option value="ja">日本語</option>
    </select>
  );
};

export default LanguageSelector; 