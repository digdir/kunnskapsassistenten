import pandas as pd

# Polite user responses data
polite_conversation_ids = [
    'SqGue1fI7cfj5SuM8o46f', 'i9Wy6xX9QFvDV23dc34O3', '2Dyzqhw108T7StTVsDG0l',
    'sKfVSwro_AW1Jxn9UzjRV', 'lxlGZtVm3dTbKGXk9KdDZ', 'JshX6q1GGJ3bAq2SLPGGW',
    'gluSLlm88NP80-OUx9Inj', '2yRusU3RLC-wWzQrkm_7V', 'M-WvPoM8o-TyBtXVqJ7ki',
    'yLYGrMYJZQ9xa6YsRPzKT', 'joJkSv5FTEm8KNXJY_io3', 'Q9LZNSxdGoJJps4ElDqyd',
    '0HcNPdMLEF_eU2Jcq41PV', 'ULHIKZOYqrUH7IAfZGduB', 'RuUMKB9ShywuAEgAUIPVS',
    'NYAPPJlEuhFQ-ERnC3v2X'
]

polite_reasons = [
    'Reason: The user consistently makes courteous, request-based replies without criticism, anger, or strictness, demonstrating a polite tone throughout the conversation.',
    'Reason: The user consistently uses courteous language and polite requests ("Hei, …", "Kan jeg få…", "Finnes det…") without any sign of anger, strictness, or praise, indicating a particularly polite tone.',
    'Reason: The user consistently thanks the assistant, uses courteous language, and asks for further clarification without any anger or strictness.',
    'Reason: Both user messages are courteously phrased, using greetings and polite requests without any irritation or strictness.',
    'Reason: The user consistently uses courteous language, thanks the assistant, and makes polite requests for further information.',
    'Reason: The user thanks the assistant and politely asks for a revision without citations, showing courteous behavior.',
    'Reason: The user repeatedly thanks the assistant ("Takk") and makes courteous requests, showing a notably polite tone.',
    'Reason: The user repeatedly begins messages with "takk" and makes courteous requests, showing consistent politeness.',
    'Reason: The user politely requests a comprehensive update to the note, using courteous language and expressing appreciation for the assistant\'s help.',
    'Reason: The user consistently makes courteous, respectful requests and even says "takk," showing a particularly polite tone.',
    'Reason: The user consistently thanks the assistant, asks for information politely, and gently points out an error without hostility or anger.',
    'Reason: The user makes a courteous request for information and assistance without any negativity or criticism.',
    'Reason: The user politely asks for a specific link, showing courteous and respectful language without any anger or strictness.',
    'Reason: The user consistently uses courteous language, acknowledges corrections positively ("Fint!"), and makes clear, respectful requests without anger or criticism.',
    'Reason: The user responds with a courteous, enthusiastic "Ooh!" and asks for more information, showing polite curiosity without any anger or criticism.',
    'Reason: The user repeatedly thanks the assistant ("Takk!") and makes courteous requests for additional information, showing a consistently polite tone.'
]

# Strict user responses data
strict_conversation_ids = [
    'guNQJ1Yh3UXqum_nPrEW2', 'WMnsS3oGSZ3p9JQnWhYKe', 'RNCnbauKPbi95Xe-bkvve',
    'UmGVKBu6wlpgI8q8OdUHD', 'R28g4s7Ey7MRpYICiCcbS', '6iRdNYynK6RuLCnKo5tRf',
    '2uNO2GmBqtg4Flln-5HHs', 'rfeNYNOLmKYfbKDE6bWXd', 'XDz4j2JHl4qrJ6fHHZInq',
    'v44EXE3eNGopZI1Z_jNWO', '9cY6cQoiY93bviw9eZ7gM', 'qGD7K3LdihgqwWlF6ibpN',
    'vu-0AbREYScg2gSXZjncT', '6g1YlcYQVyX_NYyG_l-VV', 'vAoLk0McyNe4w0YDdOPjX',
    'zlBybo2KXCrUVhaNlqsvw', 'hIRBqDeUnf6CGYnK4iW6u', '5Cf-NBg1AdCUPKJ6cOL2d',
    'QZzelE7QRUY0b0tMtv8Cy', 'JTBtwb32C6LTqMywiMcGx', 'mYEJUrHOrzp0QaadZ02sc',
    'azUnXd2BuGnuik4ITc6Nz', '-c3CKdTi2h2rwGb-2YjOh', '8MvrvLgiv-pl2EEtIdTtQ'
]

strict_reasons = [
    'Reason: The user consistently requests detailed, precise information and source attribution in a demanding, corrective manner, without expressing politeness, praise, or anger.',
    'Reason: The user\'s replies are brief, direct requests for updated sources and specific reports, showing a demanding tone without politeness or praise.',
    'Reason: The user repeatedly corrects the assistant and firmly insists on staying within the specified topics, showing a strict but not angry tone.',
    'Reason: The user calmly but firmly corrects the assistant\'s omission and demands a more complete comparison, showing a precise, directive tone without anger or praise.',
    'Reason: The user persistently points out inconsistencies, demands accurate and detailed data, and corrects the assistant, showing a demanding but non-hostile tone.',
    'Reason: The user bluntly demands a corrected answer with accurate PDF page numbers, indicating a firm, unsatisfied tone rather than politeness or praise.',
    'Reason: The user consistently issues direct, demanding requests for specific information and expects the assistant to locate and provide exact text, reflecting a strict tone without overt politeness or anger.',
    'Reason: The user repeatedly demands concise information and uses an imperative, all-caps request, indicating a strict and demanding tone rather than politeness or anger.',
    'Reason: The user repeatedly corrects, redirects, and critiques the assistant\'s output in a firm but polite manner, showing a strict tone without anger.',
    'Reason: The user repeatedly demands specific, detailed information and corrections, showing a demanding and precise tone without anger or politeness.',
    'Reason: The user explicitly demands that the answer be limited to sources from welfare agencies only, imposing a strict constraint on the assistant\'s response.',
    'Reason: The user consistently requests detailed, specific information, points out omissions, and asks for further comparative analysis, indicating a demanding but not hostile tone.',
    'Reason: The user repeatedly demands precise, factual examples and clarification, maintaining a formal and exacting tone without politeness or praise.',
    'Reason: The user repeatedly asks for more precise, specific details and highlights missing information, displaying a firm and demanding tone without hostility.',
    'Reason: The user points out that the assistant\'s previous answer missed the requested focus and emphatically asks to redo the task, showing a firm, corrective tone.',
    'Reason: The user explicitly tells the assistant to limit the answer to education research only, directing the scope of the response.',
    'Reason: The user questions the assistant\'s source choices and demands clarification, displaying a firm, corrective tone without politeness or praise.',
    'Reason: The user\'s brief "Nei" is a curt, no-nonsense reply, showing a strict, dismissive attitude toward the assistant\'s prior answer.',
    'Reason: The user repeatedly corrects the assistant and demands accurate links, showing a firm and demanding tone without overt anger.',
    'Reason: The user consistently requests specific data and tables, pressing the assistant for detailed information despite earlier limitations, indicating a firm, demanding tone without politeness or anger.',
    'Reason: The user directly points out that the assistant\'s answer does not meet the request and asks for a more specific example, using a firm and corrective tone.',
    'Reason: The user repeatedly challenges the assistant\'s answers and demands precise information, showing a firm, demanding tone without overt anger or praise.',
    'Reason: The user explicitly demands a more comprehensive list beyond the assistant\'s prior answer, displaying a firm and demanding tone without anger or praise.',
    'Reason: The user consistently demands precise corrections and clarifications, directing the assistant\'s focus without showing politeness or praise, reflecting a strictly directive tone.'
]

# Create DataFrames
polite_df = pd.DataFrame({
    'conversation_id': polite_conversation_ids,
    'sentiment': 'polite',
    'reason': polite_reasons
})

strict_df = pd.DataFrame({
    'conversation_id': strict_conversation_ids,
    'sentiment': 'strict',
    'reason': strict_reasons
})

# Save to CSV files
polite_df.to_csv('ka_api/polite_conversations.csv', index=False)
strict_df.to_csv('ka_api/strict_conversations.csv', index=False)

print(f"Created polite_conversations.csv with {len(polite_df)} rows")
print(f"Created strict_conversations.csv with {len(strict_df)} rows")
