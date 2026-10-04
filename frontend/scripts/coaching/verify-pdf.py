"""Verify every lesson's two-page spread and add navigation bookmarks."""
import json
from pathlib import Path
from pypdf import PdfReader, PdfWriter

root = Path(__file__).resolve().parents[3]
data = json.loads((root / 'frontend/public/coaching/lessons.json').read_text(encoding='utf-8'))
pdf = root / 'output/pdf/网球教练120课-完整手册.pdf'
reader = PdfReader(pdf)
assert len(reader.pages) == 248, f'Expected 8 guide/index + 240 lesson pages, got {len(reader.pages)}'
for i, lesson in enumerate(data['lessons']):
    p = 8 + i * 2
    first = reader.pages[p].extract_text()
    second = reader.pages[p + 1].extract_text()
    assert lesson['title'] in first, f'Missing title {lesson["id"]}'
    assert '练习 A' in first and '练习 B' in first, f'Incomplete first page {lesson["id"]}'
    assert '应用与带课记录' in second and '下节课怎么接' in second, f'Incomplete second page {lesson["id"]}'
    assert '第1页／共2页' in first and '第2页／共2页' in second, f'Overflow {lesson["id"]}'
    assert '\ufffd' not in first + second, f'Replacement glyph {lesson["id"]}'
writer = PdfWriter()
writer.clone_document_from_reader(reader)
writer.add_outline_item('使用指南', 0)
for level in data['levels']:
    parent = writer.add_outline_item(level['name'] + ' / 目录', level['id'] + 1)
    for lesson in [x for x in data['lessons'] if x['level'] == level['id']]:
        writer.add_outline_item(lesson['id'] + ' ' + lesson['title'], 8 + (int(lesson['id']) - 1) * 2, parent=parent)
writer.add_metadata({'/Title': '网球教练120课 - 完整手册', '/Author': 'Tennis Agent', '/Subject': '6个水平，120节中文教练教案，含场地图、验收与记录'})
with pdf.open('wb') as stream:
    writer.write(stream)
check = PdfReader(pdf)
assert len(check.pages) == 248
print('PASS: all 120 two-page lessons contain required Chinese content; 248 pages; bookmarks added.')
