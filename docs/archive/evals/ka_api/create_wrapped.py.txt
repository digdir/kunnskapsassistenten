#!/usr/bin/env python3
"""Create an improved 'wrapped' analysis of conversations."""

import json
from typing import List, Dict, Tuple
from collections import Counter, defaultdict
from datetime import datetime
import statistics


def categorize_query(query: str) -> List[str]:
    """Categorize a query based on keywords and patterns."""
    query_lower = query.lower()
    categories: List[str] = []

    category_keywords = {
        'Tildelingsbrev og styringsdokumenter': ['tildelingsbrev', 'tildelingsbrevene', 'tildelingsbrevet', 'styringsdialog'],
        'NOU og offentlige utredninger': ['nou', 'utredning', 'utredninger', 'offentlig utredning'],
        'Statistikk og data': ['statistikk', 'statistiske', 'tall', 'data', 'ssb', 'bufdir'],
        'Asyl og innvandring': ['asylsøker', 'asylsøkere', 'enslige mindreårige', 'flyktning', 'innvandring'],
        'Tilskudd og finansiering': ['tilskudd', 'tilskuddsordning', 'stimulab', 'gevinst', 'gevinstkategori'],
        'Evalueringer og analyser': ['evaluering', 'evaluer', 'analyse', 'vurder', 'gjennomgang'],
        'Internasjonale sammenligninger': ['andre land', 'andre lands', 'internasjonalt', 'sammenlign'],
        'Prosjekter og tiltak': ['prosjekt', 'prosjekter', 'tiltak', 'treffsikre tiltak'],
        'Dokumentasjon og kilder': ['dokument', 'dokumenter', 'kilde', 'kilder', 'kudos', 'referanse'],
        'Maktbruk og tvang': ['maktbruk', 'maktmiddel', 'maktmidler', 'tvang', 'tvangsmiddel'],
        'Arbeidskraft og sysselsetting': ['arbeidskraft', 'mangel på arbeidskraft', 'sysselsetting', 'nav'],
        'Befolkningsutvikling': ['befolkning', 'aldring', 'demografisk', 'perspektivmelding'],
        'Kultur og kulturpolitikk': ['kultur', 'kulturtanken', 'kulturell', 'kulturpolitikk'],
        'Likestilling og mangfold': ['likestilling', 'kjønnsbalanse', 'kvinner', 'menn', 'mangfold', 'diskriminering', 'lønnsforskjeller'],
        'Årsrapporter og rapportering': ['årsrapport', 'rapport', 'rapporterer', 'rapportering', 'nøkkeltall'],
        'Forsvar og beredskap': ['forsvar', 'forsvarsbudsjett', 'ukraina', 'militær', 'nato', 'verneplikt'],
        'Direktorater og etater': ['dsb', 'politiet', 'udi', 'digdir', 'nkom', 'statsbygg', 'uib', 'uio', 'ntnu', 'språkrådet', 'nim', 'nfi'],
        'Digitalisering': ['digitalisering', 'digital', 'digitalt', 'digitaliser', 'it-system'],
        'Kunstig intelligens (AI)': ['kunstig intelligens', 'ai', 'maskinlæring', 'chatbot', 'chat-bot', 'automatisering'],
        'Barnevern og barnets rettigheter': ['barneombud', 'barnets', 'barnevern', 'barns rettigheter', 'barnevernsinstitusjon'],
        'Språk og oversettelse': ['bokmål', 'nynorsk', 'språkrådet', 'språk', 'oversettelse', 'oversatt'],
        'Fullmakter og beslutningsmyndighet': ['fullmakt', 'beslutningsmyndighet', 'delegering', 'myndighet'],
        'Høringer og innspill': ['høring', 'høringsuttalelse', 'høringsvar', 'innspill', 'prop.', 'stortingsmelding', 'meld. st'],
        'Personvern og GDPR': ['personvern', 'gdpr', 'personopplysninger', 'persondata', 'databehandling', 'samtykke'],
        'Offentlig anskaffelse': ['anskaffelse', 'offentlig innkjøp', 'anbudskonkurranse', 'anbud', 'konkurranse'],
        'Helse og omsorg': ['helse', 'omsorg', 'pasient', 'helsetjeneste', 'sykehus', 'fastlege', 'pleie'],
        'Utdanning og universitet': ['skole', 'utdanning', 'elev', 'student', 'lærer', 'undervisning', 'fag', 'universitet'],
        'Lovverk og regelverk': ['lov', 'forskrift', 'regelverk', '§', 'paragraf', 'lovgivning', 'juridisk'],
        'Arbeidsliv og HR': ['arbeidsliv', 'ansatt', 'arbeidsgiver', 'arbeidsforhold', 'rekruttering', 'hr', 'lønn', 'sykemelding', 'permisjon', 'deltid'],
        'Økonomi og budsjett': ['økonomi', 'budsjett', 'regnskap', 'finansiering', 'bevilgning', 'økonomistyring'],
        'Kommunikasjon og medier': ['kommunikasjon', 'medier', 'presse', 'sosiale medier', 'informasjon'],
        'Miljø og klima': ['miljø', 'klima', 'bærekraft', 'utslipp', 'forurensning'],
        'Sikkerhet og beredskap': ['sikkerhet', 'beredskap', 'krise', 'risiko', 'cybersikkerhet', 'kjernegrupper'],
        'Innovasjon og utvikling': ['innovasjon', 'utvikling', 'forbedring', 'modernisering', 'fremtidens'],
        'Organisasjon og ledelse': ['organisasjon', 'ledelse', 'styring', 'struktur', 'organisering', 'virksomhet'],
        'Samarbeid og samordning': ['samarbeid', 'samordning', 'koordinering', 'partnerskap'],
        'Utfordringer og barrierer': ['utfordring', 'barriere', 'hindring', 'problem', 'vanske'],
    }

    for category, keywords in category_keywords.items():
        for keyword in keywords:
            if keyword in query_lower:
                categories.append(category)
                break

    if not categories:
        categories.append('Annet')

    return categories


def analyze_conversations(file_path: str) -> Dict:
    """Analyze conversations from JSONL file."""
    conversations: List[Dict] = []

    with open(file_path, 'r', encoding='utf-8') as f:
        for line in f:
            try:
                data = json.loads(line)
                conversations.append(data)
            except json.JSONDecodeError:
                continue

    # Extract metrics
    stats = {
        'total_conversations': len(conversations),
        'conversations_with_messages': 0,
        'total_user_messages': 0,
        'total_assistant_messages': 0,
        'total_sources': 0,
        'conversations_by_day': Counter(),
        'conversations_by_month': Counter(),
        'message_counts': [],
        'user_query_lengths': [],
        'categories': Counter(),
        'longest_conversations': [],
        'sources_per_conversation': [],
    }

    for conv in conversations:
        messages = conv.get('messages', [])
        if not messages or len(messages) == 0:
            continue

        stats['conversations_with_messages'] += 1
        stats['message_counts'].append(len(messages))

        # Parse timestamp
        created = conv.get('conversation', {}).get('created', 0)
        if created:
            dt = datetime.fromtimestamp(created / 1000)
            stats['conversations_by_day'][dt.strftime('%A')] += 1
            stats['conversations_by_month'][dt.strftime('%Y-%m')] += 1

        # Count messages and sources
        user_msgs: List[str] = []
        assistant_msgs = 0
        sources_in_conv = 0

        for msg in messages:
            role = msg.get('role')
            text = msg.get('text', '')

            if role == 'user' and text:
                stats['total_user_messages'] += 1
                user_msgs.append(text)
                stats['user_query_lengths'].append(len(text))

                # Categorize
                categories = categorize_query(text)
                for cat in categories:
                    stats['categories'][cat] += 1

            elif role == 'assistant':
                stats['total_assistant_messages'] += 1
                assistant_msgs += 1

                # Count sources/chunks
                chunks = msg.get('chunks', [])
                sources_in_conv += len(chunks)

        stats['total_sources'] += sources_in_conv
        if sources_in_conv > 0:
            stats['sources_per_conversation'].append(sources_in_conv)

        # Track longest conversations
        if len(messages) > 5:
            stats['longest_conversations'].append({
                'id': conv.get('conversation', {}).get('id'),
                'messages': len(messages),
                'user_messages': len(user_msgs),
            })

    # Sort longest conversations
    stats['longest_conversations'].sort(key=lambda x: x['messages'], reverse=True)
    stats['longest_conversations'] = stats['longest_conversations'][:20]

    return stats


def format_report(stats: Dict) -> str:
    """Format statistics into a report."""
    lines: List[str] = []

    lines.append("=" * 80)
    lines.append("KUNNSKAPSASSISTENTEN - WRAPPED 2025")
    lines.append("=" * 80)
    lines.append("")

    # Overview
    lines.append("📊 OVERSIKT")
    lines.append("-" * 80)
    lines.append(f"Totalt antall samtaler: {stats['total_conversations']:,}")
    lines.append(f"Samtaler med meldinger: {stats['conversations_with_messages']:,}")
    lines.append(f"Totalt antall bruker-spørsmål: {stats['total_user_messages']:,}")
    lines.append(f"Totalt antall assistent-svar: {stats['total_assistant_messages']:,}")
    lines.append(f"Totalt antall kilder brukt: {stats['total_sources']:,}")
    lines.append("")

    # Conversation length stats
    if stats['message_counts']:
        lines.append("💬 SAMTALELENGDE")
        lines.append("-" * 80)
        lines.append(f"Gjennomsnittlig meldinger per samtale: {statistics.mean(stats['message_counts']):.1f}")
        lines.append(f"Median meldinger per samtale: {statistics.median(stats['message_counts']):.0f}")
        lines.append(f"Lengste samtale: {max(stats['message_counts'])} meldinger")
        lines.append(f"Korteste samtale: {min(stats['message_counts'])} meldinger")
        lines.append("")

    # Sources per conversation
    if stats['sources_per_conversation']:
        lines.append("📚 KILDEBRUK")
        lines.append("-" * 80)
        lines.append(f"Gjennomsnittlig kilder per samtale: {statistics.mean(stats['sources_per_conversation']):.1f}")
        lines.append(f"Median kilder per samtale: {statistics.median(stats['sources_per_conversation']):.0f}")
        lines.append(f"Mest kilder i én samtale: {max(stats['sources_per_conversation'])}")
        lines.append(f"Samtaler med kilder: {len(stats['sources_per_conversation']):,}")
        lines.append("")

    # User query length
    if stats['user_query_lengths']:
        lines.append("✍️  SPØRSMÅLSLENGDE")
        lines.append("-" * 80)
        lines.append(f"Gjennomsnittlig tegn per spørsmål: {statistics.mean(stats['user_query_lengths']):.0f}")
        lines.append(f"Median tegn per spørsmål: {statistics.median(stats['user_query_lengths']):.0f}")
        lines.append(f"Lengste spørsmål: {max(stats['user_query_lengths']):,} tegn")
        lines.append(f"Korteste spørsmål: {min(stats['user_query_lengths'])} tegn")
        lines.append("")

    # Day of week
    lines.append("📅 BRUK PER UKEDAG")
    lines.append("-" * 80)
    weekday_order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    weekday_names = {
        'Monday': 'Mandag',
        'Tuesday': 'Tirsdag',
        'Wednesday': 'Onsdag',
        'Thursday': 'Torsdag',
        'Friday': 'Fredag',
        'Saturday': 'Lørdag',
        'Sunday': 'Søndag',
    }
    for day in weekday_order:
        count = stats['conversations_by_day'].get(day, 0)
        name = weekday_names[day]
        bar = '█' * (count // 5)
        lines.append(f"{name:.<20} {count:>4} {bar}")
    lines.append("")

    # Month
    lines.append("📆 BRUK PER MÅNED")
    lines.append("-" * 80)
    for month in sorted(stats['conversations_by_month'].keys()):
        count = stats['conversations_by_month'][month]
        bar = '█' * (count // 10)
        lines.append(f"{month:.<20} {count:>4} {bar}")
    lines.append("")

    # Categories
    lines.append("🏷️  TEMATISKE KATEGORIER (Top 20)")
    lines.append("-" * 80)
    total_queries = stats['total_user_messages']
    for i, (category, count) in enumerate(stats['categories'].most_common(20), 1):
        pct = (count / total_queries * 100) if total_queries > 0 else 0
        lines.append(f"{i:2}. {category:.<50} {count:>5} ({pct:>5.1f}%)")
    lines.append("")

    # Longest conversations
    lines.append("🔥 LENGSTE SAMTALER (Top 20)")
    lines.append("-" * 80)
    for i, conv in enumerate(stats['longest_conversations'], 1):
        lines.append(f"{i:2}. {conv['id']} - {conv['messages']} meldinger ({conv['user_messages']} fra bruker)")
    lines.append("")

    lines.append("=" * 80)
    lines.append("Generert: " + datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
    lines.append("=" * 80)

    return '\n'.join(lines)


def main() -> None:
    """Main function."""
    file_path = 'prod_conversations_20251208_094358.jsonl'

    print("Analyserer samtaler...")
    stats = analyze_conversations(file_path)

    print("Genererer rapport...")
    report = format_report(stats)

    # Write to file
    output_file = 'wrapped_improved.md'
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(report)

    print(f"\n✅ Rapport lagret til: {output_file}\n")
    print(report)


if __name__ == '__main__':
    main()
