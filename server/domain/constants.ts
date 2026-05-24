export const FIXED_CHAPTERS = [
  { id: 'childhood', order: 1, slug: 'childhood', title: '유년기' },
  { id: 'adolescence', order: 2, slug: 'adolescence', title: '청소년기' },
  { id: 'youth', order: 3, slug: 'youth', title: '청년기' },
  { id: 'family_home', order: 4, slug: 'family-home', title: '가정을 꾸린 이야기' },
  { id: 'hobbies', order: 5, slug: 'hobbies', title: '취미' },
  { id: 'relationships', order: 6, slug: 'relationships', title: '인간관계' },
  { id: 'messages', order: 7, slug: 'messages', title: '전하고 싶은 이야기' },
] as const;

export const COMMON_QUESTIONS = [
  ['childhood', '태어난 곳은 어떤 동네였나요?'],
  ['childhood', '어린 시절 집 주변에서 가장 선명하게 기억나는 풍경은 무엇인가요?'],
  ['childhood', '어릴 때 가장 좋아했던 놀이는 무엇이었나요?'],
  ['childhood', '부모님께 가장 자주 들었던 말은 무엇인가요?'],
  ['childhood', '어린 시절 가장 따뜻하게 남아 있는 하루는 언제인가요?'],
  ['adolescence', '학창 시절 가장 기억에 남는 선생님이나 친구는 누구인가요?'],
  ['adolescence', '학교에 가는 길은 어떤 모습이었나요?'],
  ['adolescence', '청소년기에 처음으로 스스로 해낸 일은 무엇인가요?'],
  ['adolescence', '그 시절 마음을 많이 쓰게 했던 고민은 무엇이었나요?'],
  ['adolescence', '졸업 무렵 어떤 마음이 드셨나요?'],
  ['youth', '처음 일을 시작했을 때 어떤 기분이셨나요?'],
  ['youth', '첫 월급이나 첫 수입은 어떻게 기억하시나요?'],
  ['youth', '청년 시절 가장 큰 선택은 무엇이었나요?'],
  ['youth', '젊은 날 가장 자랑스럽게 여기는 순간은 언제인가요?'],
  ['youth', '그때 다시 만나고 싶은 사람이 있다면 누구인가요?'],
  ['family_home', '배우자나 가족과 처음 집을 꾸렸을 때의 기억은 어떤가요?'],
  ['family_home', '자녀가 태어났을 때 가장 먼저 떠오른 생각은 무엇이었나요?'],
  ['family_home', '가족을 위해 가장 애썼던 시기는 언제였나요?'],
  ['family_home', '집 안에서 가장 자주 반복되던 풍경은 무엇이었나요?'],
  ['family_home', '가족에게 미처 다 하지 못한 말이 있나요?'],
  ['hobbies', '살면서 오래 좋아해 온 취미나 즐거움은 무엇인가요?'],
  ['hobbies', '좋아하는 음식, 노래, 계절 중 하나를 고른다면 무엇인가요?'],
  ['hobbies', '혼자 있을 때 마음을 편하게 해 준 일은 무엇인가요?'],
  ['relationships', '인생에서 고마운 사람 한 분을 떠올리면 누구인가요?'],
  ['relationships', '오래 기억에 남는 이웃이나 동료가 있나요?'],
  ['relationships', '관계를 통해 배운 가장 큰 교훈은 무엇인가요?'],
  ['relationships', '다시 사과하거나 고맙다고 말하고 싶은 사람이 있나요?'],
  ['messages', '자녀와 손주에게 꼭 남기고 싶은 말은 무엇인가요?'],
  ['messages', '살아오며 지켜 온 가치관이 있다면 무엇인가요?'],
  ['messages', '마지막 장에 꼭 담고 싶은 한 문장은 무엇인가요?'],
] as const;

export const MIN_ANSWERS_PER_CHAPTER = 15;

export const COVER_PALETTES = ['warm_archive', 'quiet_blue', 'garden_green', 'classic_ink'] as const;
export const COVER_TEMPLATES = ['framed_portrait', 'chapter_band', 'letterpress', 'photo_plate'] as const;
export const COVER_FONTS = ['궁서체', '명조체', '고딕체'] as const;
