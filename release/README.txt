Release folder — what to send to colleagues
==========================================

After building (see build/BUILD.md):

  MAC USERS
  ---------
  1. Build on a Mac: ./build/build_mac.sh
  2. Copy the ENTIRE folder "dist/School Timetable Generator" here:
       release/macOS/School Timetable Generator/
  3. Zip "release/macOS/School Timetable Generator" (or the parent macOS folder).
  4. Send the zip to Mac colleagues.
  5. Include DISTRIBUTION_README.md (from project root) in the zip or by email.

  WINDOWS USERS
  -------------
  1. Build on Windows: build\build_win.bat
  2. Copy the ENTIRE folder "dist\School Timetable Generator" here:
       release/Windows/School Timetable Generator/
  3. Zip "release/Windows/School Timetable Generator" (or the parent Windows folder).
  4. Send the zip to Windows colleagues.
  5. Include DISTRIBUTION_README.md in the zip or by email.

  WHAT TO SEND
  ------------
  • Mac users: the zip containing "School Timetable Generator" (folder with the Mac executable + _internal).
  • Windows users: the zip containing "School Timetable Generator" (folder with .exe + DLLs).
  • Everyone: DISTRIBUTION_README.md (how to install, open, report bugs, where files are stored).

  Do NOT mix: Mac build only runs on Mac; Windows build only runs on Windows.
