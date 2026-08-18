"""Professional tour database (ATP / WTA / ITF).

Pipeline: GitHub open archives in Sackmann format -> SQLite -> advanced
metrics -> scouting reports. The archive is used because ATP/WTA websites are
protected by anti-bot services. It covers matches from 1968 onward, serve
statistics, challenger/ITF events, player metadata, and weekly rankings.
"""
