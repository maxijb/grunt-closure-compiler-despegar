module.exports = function(grunt) {

  'use strict';

  var exec = require('child_process').exec,
      fs = require('fs'),
      gzip = require('zlib').gzip,
      totalFiles = 0,
      filesCompleted = 0,
      done = null,
      closurePath = '',
      reportFile = '',
      data = '',
      minifiedSuffix = ".cc_temp_minified.js",
      jsOriginal = [];

  // ==========================================================================
  // TASKS
  // ==========================================================================

  grunt.registerMultiTask('closure-compiler-despegar', 'Minify JS files using Closure Compiler.', function() {

	  
	  
        data = this.data;
    
        done = this.async();
        

    // Check for closure path.
    if (data.closurePath) {
      closurePath = data.closurePath;
    } else if (process.env.CLOSURE_PATH) {
      closurePath = process.env.CLOSURE_PATH;
    } else {
      grunt.log.error('' +
          '/!\\'.red +
          ' Set an environment variable called ' +
          'CLOSURE_PATH'.red + ' or the build parameter' + 'closurePath'.red +
          ' and\nmake it point to your root install of Closure Compiler.' +
          '\n');
      return false;
    }
    
    if (typeof data.js == "string" && data.js.indexOf(',') != -1) {
    	data.js = data.js.split(',');
    }
    
    data.js = grunt.file.expand(data.js);
    if (!data.js.length) {
    	// This task requires a minima an input file.
    	grunt.warn('Missing js property.');
    	return false;
    }

    
    
    if (data.expand) {
    	jsOriginal = data.js;
    	data.js = jsOriginal[1];
    	compressNow(data);
    }
    else {
    	compressNow(data);
    }
    
  });
  
  
  function endCompress(compressed) {
	  var tempOut = compressed.jsOutputFile;
	  if (compressed.overrideSource) {
		  grunt.file.copy( compressed.jsOutputFile, compressed.js);
		  grunt.file.delete(compressed.jsOutputFile);
		  tempOut = compressed.js;
	  }
	  if (compressed.sourcemap) {
		  console.log("Agregando sourcemap")
		  fs.appendFile(tempOut, '\n//# sourceMappingURL=' + compressed.sourcemapPrefix + compressed.jsOutputMapFile, function (err) {
			  console.log("Sourcemap agregado.");  
			  compressReady();
		  });
	  }
	  else {
		  compressReady();
	  }
	  
	  
  }
  
  function compressReady() {
	  filesCompleted++;
	  console.log("Comprimidos " + filesCompleted + " de " + jsOriginal.length + " archivos...");
	  //si es uno soloel archivo terminamos
	  if (!jsOriginal || filesCompleted >= jsOriginal.length) done();
	  else {
		  console.log("hasta aqui");
		  data.js = jsOriginal[filesCompleted];
		  compressNow(data);
	  }
  }
  
  
  function compressNow(data) {
    
    
    var command = 'java -jar ' + closurePath + '/build/compiler.jar';

    // Sanitize options passed.

    // Build command line.
    command += ' --js ';
    command += (typeof data.js === "string") ? data.js : data.js.join(' --js ');
    
    console.log("!!!!!!!!!!!!!!" + data.jsOutputFile);
    //si tiene que sobrescribir guarda un archivo temporal
    if (data.jsOutputFile != 'self') {
    	data.jsOutputMapFile = data.jsOutputFile + '.map';
    	data.overrideSource = false; 
    }
    else {
    	console.log("((((((((((((((((((((((2" +data.js);
    	data.jsOutputMapFile = data.js + '.map';
    	data.overrideSource = true; 
    }
    
    if (data.sourcemap) {
    	command += " --create_source_map " + data.jsOutputMapFile + " --source_map_format=V3";
    }
    
    
    if (data.jsOutputFile) {
      command += ' --js_output_file ' + data.jsOutputFile;
      reportFile = data.reportFile || data.jsOutputFile + '.report.txt';
    }
  

    if (data.externs) {
      data.externs = grunt.file.expand(data.externs);
      command += ' --externs ' + data.externs.join(' --externs ');

      if (!data.externs.length) {
        delete data.externs;
      }
    }

    if (data.options.externs) {
      data.options.externs = grunt.file.expand(data.options.externs);

      if (!data.options.externs.length) {
        delete data.options.externs;
      }
    }

    for (var directive in data.options) {
      if (Array.isArray(data.options[directive])) {
        command += ' --' + directive + ' ' + data.options[directive].join(' --' + directive + ' ');
      } else if (data.options[directive] === undefined || data.options[directive] === null) {
        command += ' --' + directive;
      } else {
        command += ' --' + directive + ' "' + String(data.options[directive]) + '"';
      }
    }

    console.log(command);
    
    // Minify WebGraph class.
    exec(command, { maxBuffer: data.maxBuffer * 1024 }, function(err, stdout, stderr) {
      if (err) {
        grunt.warn(err);
        done(false);
      }

      if (stdout) {
        grunt.log.writeln(stdout);
      }

      // If OK, calculate gzipped file size.
      if (reportFile.length) {
        var min = fs.readFileSync(data.jsOutputFile, 'utf8');
        min_info(min, function(err) {
          if (err) {
            grunt.warn(err);
            done(false);
          }

          if (data.noreport) {
            endCompress(data);
          } else {
            // Write compile report to a file.
            fs.writeFile(reportFile, stderr, function(err) {
              if (err) {
                grunt.warn(err);
                done(false);
              }

              grunt.log.writeln('A report is saved in ' + reportFile + '.');
              endCompress(data);
            });
          }

        });
      } else {
        if (data.report) {
          grunt.log.error(stderr);
        }
        endCompress(data);
      }

    });

  }

  // Output some size info about a file.
  function min_info(min, onComplete) {
    gzip(min, function(err, buffer) {
      if (err) {
        onComplete.call(this, err);
      }

      var gzipSize = buffer.toString().length;
      grunt.log.writeln('Compressed size: ' + String((gzipSize / 1024).toFixed(2)).green + ' kb gzipped (' + String(gzipSize).green + ' bytes).');

      onComplete.call(this, null);
    });
  }

};
