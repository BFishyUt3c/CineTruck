package com.example.foroservice.Infrastructure.Controllers;

import com.example.foroservice.Application.Services.ThreadService;
import com.example.foroservice.Domain.Entities.ForumThread;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/threads")
@RequiredArgsConstructor
public class ThreadController {

    private final ThreadService threadService;

    @GetMapping
    public ResponseEntity<List<ForumThread>> getAll() {
        return ResponseEntity.ok(threadService.getAll());
    }

    @GetMapping("/all")
    public ResponseEntity<Page<ForumThread>> getAllPaginated(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "date") String sortBy,
            @RequestParam(defaultValue = "DESC") Sort.Direction direction) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(direction, sortBy));
        return ResponseEntity.ok(threadService.getAllPaginated(pageable));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ForumThread> getById(@PathVariable String id) {
        return ResponseEntity.ok(threadService.getById(id));
    }

    @GetMapping("/movie/{movieId}")
    public ResponseEntity<List<ForumThread>> getByMovieId(@PathVariable String movieId) {
        return ResponseEntity.ok(threadService.getByMovieId(movieId));
    }

    @GetMapping("/movie/{movieId}/paginated")
    public ResponseEntity<Page<ForumThread>> getByMovieIdPaginated(
            @PathVariable String movieId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "date") String sortBy,
            @RequestParam(defaultValue = "DESC") Sort.Direction direction) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(direction, sortBy));
        return ResponseEntity.ok(threadService.getByMovieIdPaginated(movieId, pageable));
    }

    @PostMapping
    public ResponseEntity<ForumThread> create(@RequestBody ForumThread thread) {
        return ResponseEntity.status(HttpStatus.CREATED).body(threadService.create(thread));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ForumThread> delete(@PathVariable String id) {
        threadService.delete(id);
        return ResponseEntity.noContent().build();
    }

}
